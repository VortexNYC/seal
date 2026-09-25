import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { D1Client } from "../global/db.js";
import { auditLogs } from "../global/schema.js";
import {
  AuditChainConflictError,
  buildAuditChainTipBatchItems,
  computeAuditEntryHash,
  prepareAuditChainFields,
  type CanonicalAuditPayload,
} from "./audit-chain.js";

export type AuditActor = {
  type: "user" | "agent" | "api_token";
  id: string;
};

export interface AuditLogInput {
  /** Optional stable id for atomic batches / compensation. */
  id?: string;
  organizationId: string;
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export type PreparedAuditLog = {
  values: typeof auditLogs.$inferInsert;
  payload: CanonicalAuditPayload;
  prevHash: string;
  entryHash: string;
  sequence: number;
  hadTipRow: boolean;
};

function toPayload(
  values: typeof auditLogs.$inferInsert
): CanonicalAuditPayload {
  const createdAt = values.createdAt ?? new Date();
  const createdAtMs =
    createdAt instanceof Date ? createdAt.getTime() : Number(createdAt);
  return {
    id: values.id,
    organizationId: values.organizationId,
    actorId: values.actorId,
    actorType: values.actorType,
    action: values.action,
    resourceType: values.resourceType,
    resourceId: values.resourceId ?? null,
    metadata: values.metadata ?? null,
    ipAddress: values.ipAddress ?? null,
    userAgent: values.userAgent ?? null,
    createdAtMs,
  };
}

/** Unsealed insert shape (legacy / tests). Prefer prepareChainedAuditLog. */
export function buildAuditLogValues(
  input: AuditLogInput
): typeof auditLogs.$inferInsert {
  return {
    id: input.id ?? crypto.randomUUID(),
    organizationId: input.organizationId,
    actorId: input.actor.id,
    actorType: input.actor.type,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    createdAt: input.createdAt ?? new Date(),
  };
}

export async function prepareChainedAuditLog(
  db: D1Client,
  input: AuditLogInput
): Promise<PreparedAuditLog> {
  const base = buildAuditLogValues(input);
  // Freeze createdAt so hash matches the stored row.
  const createdAt = base.createdAt ?? new Date();
  base.createdAt = createdAt;
  const payload = toPayload(base);
  const chain = await prepareAuditChainFields(db, payload);
  return {
    values: {
      ...base,
      prevHash: chain.prevHash,
      entryHash: chain.entryHash,
      sequence: chain.sequence,
    },
    payload,
    prevHash: chain.prevHash,
    entryHash: chain.entryHash,
    sequence: chain.sequence,
    hadTipRow: chain.hadTipRow,
  };
}

/**
 * Prepare N sealed rows that extend the org tip in one shot (document expiry).
 * Sequences and hashes are contiguous; tip advances once to the last entry.
 */
export async function prepareChainedAuditLogBatch(
  db: D1Client,
  inputs: AuditLogInput[]
): Promise<{
  prepared: PreparedAuditLog[];
  tipPrevHash: string;
  tipEntryHash: string;
  tipSequence: number;
  hadTipRow: boolean;
} | null> {
  if (inputs.length === 0) {
    return null;
  }
  const prepared: PreparedAuditLog[] = [];
  let tipPrevHash = "";
  let tipEntryHash = "";
  let tipSequence = 0;
  let hadTipRow = false;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!input) continue;
    if (i === 0) {
      const first = await prepareChainedAuditLog(db, input);
      prepared.push(first);
      tipPrevHash = first.prevHash;
      tipEntryHash = first.entryHash;
      tipSequence = first.sequence;
      hadTipRow = first.hadTipRow;
      continue;
    }
    const base = buildAuditLogValues(input);
    const createdAt = base.createdAt ?? new Date();
    base.createdAt = createdAt;
    const payload = toPayload(base);
    const prevHash = tipEntryHash;
    const sequence = tipSequence + 1;
    const entryHash = await computeAuditEntryHash(prevHash, payload);
    const row: PreparedAuditLog = {
      values: {
        ...base,
        prevHash,
        entryHash,
        sequence,
      },
      payload,
      prevHash,
      entryHash,
      sequence,
      hadTipRow: true,
    };
    prepared.push(row);
    tipEntryHash = entryHash;
    tipSequence = sequence;
  }

  return {
    prepared,
    tipPrevHash,
    tipEntryHash,
    tipSequence,
    hadTipRow,
  };
}

export async function writeAuditLog(
  db: D1Client,
  input: AuditLogInput
): Promise<PreparedAuditLog> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prepared = await prepareChainedAuditLog(db, input);
    const tipItems = buildAuditChainTipBatchItems(db, {
      organizationId: prepared.values.organizationId,
      prevHash: prepared.prevHash,
      entryHash: prepared.entryHash,
      sequence: prepared.sequence,
      hadTipRow: prepared.hadTipRow,
    });
    const tipHead = tipItems[0];
    if (!tipHead) {
      throw new Error("writeAuditLog: missing tip statement");
    }

    try {
      const results = await db.batch([
        db.insert(auditLogs).values(prepared.values),
        tipHead,
      ]);
      const tipResult = results[1] as Array<{ organizationId: string }>;
      if (tipResult && tipResult.length > 0) {
        return prepared;
      }
    } catch {
      // Unique tip insert race — fall through to retry after cleanup.
    }

    // Tip lost the race — remove the orphan sealed row and retry.
    await db
      .delete(auditLogs)
      .where(eq(auditLogs.id, prepared.values.id));
  }
  throw new AuditChainConflictError();
}

export function getAuditRequestMeta(c: {
  req: { header(name: string): string | undefined };
}): { ipAddress: string | undefined; userAgent: string | undefined } {
  return {
    ipAddress:
      c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
    userAgent: c.req.header("user-agent"),
  };
}

export function getAuditActor(values: {
  apiToken?: { id: string } | null;
  mcp?: { kind?: "mcp" | "api"; clientId: string; jti: string } | null;
  user?: { user: { id: string } } | null;
}): AuditActor | null {
  if (values.apiToken) {
    return { type: "api_token", id: values.apiToken.id };
  }
  if (values.mcp?.kind === "api") {
    return { type: "api_token", id: values.mcp.jti };
  }
  if (values.mcp) {
    return { type: "agent", id: values.mcp.clientId };
  }
  if (values.user) {
    return { type: "user", id: values.user.user.id };
  }
  return null;
}

/** Tip batch items for a prep already computed (signing / expiry). */
export function tipBatchItemsForPrepared(
  db: D1Client,
  prepared: Pick<
    PreparedAuditLog,
    "prevHash" | "entryHash" | "sequence" | "hadTipRow"
  > & { organizationId: string }
): BatchItem<"sqlite">[] {
  return buildAuditChainTipBatchItems(db, {
    organizationId: prepared.organizationId,
    prevHash: prepared.prevHash,
    entryHash: prepared.entryHash,
    sequence: prepared.sequence,
    hadTipRow: prepared.hadTipRow,
  });
}
