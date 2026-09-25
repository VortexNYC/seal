/**
 * Tamper-evident audit log chain (SEA-44 / CompAI fnd_6ab563f5425574f54ad441c6).
 * Per-organization hash chain: entry_hash = SHA-256(prev_hash || canonical row).
 */

import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { D1Client } from "../global/db.js";
import { auditChainTips, auditLogs } from "../global/schema.js";

export const AUDIT_GENESIS_HASH = "sha256:genesis";

export type AuditChainFields = {
  prevHash: string;
  entryHash: string;
  sequence: number;
};

export type CanonicalAuditPayload = {
  id: string;
  organizationId: string;
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAtMs: number;
};

export function canonicalizeAuditPayload(payload: CanonicalAuditPayload): string {
  // Stable key order — do not pretty-print.
  return JSON.stringify({
    id: payload.id,
    organizationId: payload.organizationId,
    actorId: payload.actorId,
    actorType: payload.actorType,
    action: payload.action,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    metadata: payload.metadata,
    ipAddress: payload.ipAddress,
    userAgent: payload.userAgent,
    createdAtMs: payload.createdAtMs,
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export async function computeAuditEntryHash(
  prevHash: string,
  payload: CanonicalAuditPayload
): Promise<string> {
  return sha256Hex(`${prevHash}\n${canonicalizeAuditPayload(payload)}`);
}

export class AuditChainConflictError extends Error {
  constructor() {
    super("Audit chain tip conflict");
    this.name = "AuditChainConflictError";
  }
}

export async function readAuditChainTip(
  db: D1Client,
  organizationId: string
): Promise<{ tipHash: string; sequence: number } | null> {
  const rows = await db
    .select({
      tipHash: auditChainTips.tipHash,
      sequence: auditChainTips.sequence,
    })
    .from(auditChainTips)
    .where(eq(auditChainTips.organizationId, organizationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function prepareAuditChainFields(
  db: D1Client,
  payload: CanonicalAuditPayload
): Promise<AuditChainFields & { hadTipRow: boolean }> {
  const tip = await readAuditChainTip(db, payload.organizationId);
  const prevHash = tip?.tipHash ?? AUDIT_GENESIS_HASH;
  const sequence = (tip?.sequence ?? 0) + 1;
  const entryHash = await computeAuditEntryHash(prevHash, payload);
  return {
    prevHash,
    entryHash,
    sequence,
    hadTipRow: tip !== null,
  };
}

/** Tip advance statements to run in the same D1 batch as the audit INSERT. */
export function buildAuditChainTipBatchItems(
  db: D1Client,
  params: {
    organizationId: string;
    prevHash: string;
    entryHash: string;
    sequence: number;
    hadTipRow: boolean;
  }
): BatchItem<"sqlite">[] {
  if (params.hadTipRow) {
    return [
      db
        .update(auditChainTips)
        .set({
          tipHash: params.entryHash,
          sequence: params.sequence,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(auditChainTips.organizationId, params.organizationId),
            eq(auditChainTips.tipHash, params.prevHash)
          )
        )
        .returning({ organizationId: auditChainTips.organizationId }),
    ];
  }
  return [
    db
      .insert(auditChainTips)
      .values({
        organizationId: params.organizationId,
        tipHash: params.entryHash,
        sequence: params.sequence,
        updatedAt: new Date(),
      })
      .returning({ organizationId: auditChainTips.organizationId }),
  ];
}

/** Revert tip after a compensated (lost-race) audit insert. */
export function buildAuditChainTipRevertBatchItems(
  db: D1Client,
  params: {
    organizationId: string;
    prevHash: string;
    entryHash: string;
    hadTipRow: boolean;
    sequence: number;
  }
): BatchItem<"sqlite">[] {
  if (!params.hadTipRow) {
    return [
      db
        .delete(auditChainTips)
        .where(
          and(
            eq(auditChainTips.organizationId, params.organizationId),
            eq(auditChainTips.tipHash, params.entryHash)
          )
        ),
    ];
  }
  return [
    db
      .update(auditChainTips)
      .set({
        tipHash: params.prevHash,
        sequence: params.sequence - 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(auditChainTips.organizationId, params.organizationId),
          eq(auditChainTips.tipHash, params.entryHash)
        )
      ),
  ];
}

export type AuditChainVerifyResult = {
  ok: boolean;
  checked: number;
  unbrokenPrefix: number;
  tipHash: string | null;
  tipSequence: number | null;
  firstBreak: {
    id: string;
    sequence: number | null;
    expected: string;
    actual: string | null;
  } | null;
};

/**
 * Verify sealed rows (those with entry_hash) in createdAt/id order.
 * Legacy null-hash rows are skipped and do not break the sealed chain
 * once the first sealed row appears after genesis.
 */
export async function verifyAuditChain(
  db: D1Client,
  organizationId: string
): Promise<AuditChainVerifyResult> {
  const rows = await db
    .select({
      id: auditLogs.id,
      organizationId: auditLogs.organizationId,
      actorId: auditLogs.actorId,
      actorType: auditLogs.actorType,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      prevHash: auditLogs.prevHash,
      entryHash: auditLogs.entryHash,
      sequence: auditLogs.sequence,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, organizationId),
        isNotNull(auditLogs.entryHash)
      )
    )
    .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));

  let prev = AUDIT_GENESIS_HASH;
  let unbroken = 0;
  let firstBreak: AuditChainVerifyResult["firstBreak"] = null;

  for (const row of rows) {
    const createdAt = row.createdAt;
    const createdAtMs =
      createdAt instanceof Date ? createdAt.getTime() : Number(createdAt);
    const expected = await computeAuditEntryHash(prev, {
      id: row.id,
      organizationId: row.organizationId,
      actorId: row.actorId,
      actorType: row.actorType,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId ?? null,
      metadata: row.metadata ?? null,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      createdAtMs,
    });

    if (row.prevHash !== prev || row.entryHash !== expected) {
      firstBreak = {
        id: row.id,
        sequence: row.sequence,
        expected,
        actual: row.entryHash,
      };
      break;
    }
    prev = row.entryHash ?? prev;
    unbroken += 1;
  }

  const tip = await readAuditChainTip(db, organizationId);
  const tipOk =
    unbroken === rows.length &&
    (rows.length === 0
      ? tip === null
      : tip?.tipHash === rows[rows.length - 1]?.entryHash);

  return {
    ok: firstBreak === null && tipOk,
    checked: rows.length,
    unbrokenPrefix: unbroken,
    tipHash: tip?.tipHash ?? null,
    tipSequence: tip?.sequence ?? null,
    firstBreak,
  };
}
