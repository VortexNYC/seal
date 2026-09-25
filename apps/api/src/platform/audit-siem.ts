/**
 * SEA-67 — SIEM / audit stream export.
 *
 * Push: fan sealed audit_logs out as `audit.entry.created` webhooks (HMAC,
 * retries, flush — same pipe as document events). Cursor advances per org so
 * re-runs are idempotent (eventId = audit entry id).
 *
 * Pull: NDJSON export on GET /organizations/:slug/audit/export.
 */

import { and, asc, eq, gt, isNotNull } from "drizzle-orm";

import { createD1, type D1Client } from "../global/db.js";
import {
  auditLogs,
  auditSiemCursors,
  webhooks,
} from "../global/schema.js";
import { emitWebhookEvent, webhookSubscribesTo } from "./webhook-events.js";

export const AUDIT_ENTRY_CREATED_EVENT = "audit.entry.created";

const DEFAULT_FLUSH_BATCH = 100;
const MAX_FLUSH_BATCH = 200;

function parseEvents(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((e) => typeof e === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

function parseMetadata(
  value: string | null
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return undefined;
}

export type AuditSiemEntryPayload = {
  id: string;
  organizationId: string;
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  prevHash: string | null;
  entryHash: string | null;
  sequence: number | null;
  createdAt: string;
};

export function toAuditSiemPayload(row: {
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
  prevHash: string | null;
  entryHash: string | null;
  sequence: number | null;
  createdAt: Date;
}): AuditSiemEntryPayload {
  const metadata = parseMetadata(row.metadata);
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorId: row.actorId,
    actorType: row.actorType,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    ...(metadata ? { metadata } : {}),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    prevHash: row.prevHash,
    entryHash: row.entryHash,
    sequence: row.sequence,
    createdAt: row.createdAt.toISOString(),
  };
}

function orgWantsAuditSiem(eventsJson: string | null): boolean {
  return webhookSubscribesTo(parseEvents(eventsJson), AUDIT_ENTRY_CREATED_EVENT);
}

/** Organizations with at least one active webhook listening for audit SIEM. */
export async function listAuditSiemSubscriberOrgIds(
  db: D1Client
): Promise<string[]> {
  const rows = await db
    .select({
      organizationId: webhooks.organizationId,
      events: webhooks.events,
    })
    .from(webhooks)
    .where(eq(webhooks.status, "active"));

  const orgIds = new Set<string>();
  for (const row of rows) {
    if (orgWantsAuditSiem(row.events)) {
      orgIds.add(row.organizationId);
    }
  }
  return [...orgIds];
}

export async function getAuditSiemCursor(
  db: D1Client,
  organizationId: string
): Promise<number> {
  const [row] = await db
    .select({ lastSequence: auditSiemCursors.lastSequence })
    .from(auditSiemCursors)
    .where(eq(auditSiemCursors.organizationId, organizationId))
    .limit(1);
  return row?.lastSequence ?? 0;
}

export async function setAuditSiemCursor(
  db: D1Client,
  organizationId: string,
  lastSequence: number
): Promise<void> {
  const now = new Date();
  await db
    .insert(auditSiemCursors)
    .values({
      organizationId,
      lastSequence,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: auditSiemCursors.organizationId,
      set: {
        lastSequence,
        updatedAt: now,
      },
    });
}

export type FlushAuditSiemResult = {
  organizations: number;
  entriesEnqueued: number;
};

/**
 * Enqueue audit.entry.created for sealed rows past each org's SIEM cursor.
 * Safe to run on the five-minute webhook cron — idempotent via eventId = entry id.
 */
export async function flushAuditSiemStream(
  env: CloudflareBindings,
  options: {
    organizationId?: string;
    limitPerOrg?: number;
    flushImmediately?: boolean;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<FlushAuditSiemResult> {
  const db = createD1(env.D1);
  const limitPerOrg = Math.min(
    Math.max(options.limitPerOrg ?? DEFAULT_FLUSH_BATCH, 1),
    MAX_FLUSH_BATCH
  );

  const orgIds = options.organizationId
    ? [options.organizationId]
    : await listAuditSiemSubscriberOrgIds(db);

  const subscribers = new Set(await listAuditSiemSubscriberOrgIds(db));
  let entriesEnqueued = 0;
  let orgsTouched = 0;

  for (const organizationId of orgIds) {
    if (!subscribers.has(organizationId)) {
      continue;
    }
    orgsTouched += 1;

    const cursor = await getAuditSiemCursor(db, organizationId);
    const rows = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, organizationId),
          isNotNull(auditLogs.sequence),
          gt(auditLogs.sequence, cursor)
        )
      )
      .orderBy(asc(auditLogs.sequence))
      .limit(limitPerOrg);

    if (rows.length === 0) {
      continue;
    }

    let maxSequence = cursor;
    let enqueuedThisOrg = 0;
    for (const row of rows) {
      const sequence = row.sequence;
      if (sequence === null) continue;
      const payload = toAuditSiemPayload(row);
      const result = await emitWebhookEvent(
        env,
        {
          organizationId,
          eventType: AUDIT_ENTRY_CREATED_EVENT,
          eventId: row.id,
          payload,
        },
        {
          flushImmediately: options.flushImmediately ?? false,
          fetchImpl: options.fetchImpl,
        }
      );
      if (result.deliveryCount > 0) {
        enqueuedThisOrg += 1;
        entriesEnqueued += 1;
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }

    // Only advance past rows that actually enqueued — never skip history
    // when hooks were paused mid-batch.
    if (enqueuedThisOrg > 0 && maxSequence > cursor) {
      await setAuditSiemCursor(db, organizationId, maxSequence);
    }
  }

  return { organizations: orgsTouched, entriesEnqueued };
}

/** Rows for NDJSON pull export (admin backfill / SIEM without push). */
export async function listAuditEntriesForExport(
  db: D1Client,
  organizationId: string,
  options: {
    afterSequence?: number;
    limit: number;
  }
): Promise<AuditSiemEntryPayload[]> {
  const after = options.afterSequence ?? 0;
  const rows = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, organizationId),
        isNotNull(auditLogs.sequence),
        gt(auditLogs.sequence, after)
      )
    )
    .orderBy(asc(auditLogs.sequence))
    .limit(options.limit);

  return rows.map(toAuditSiemPayload);
}

/** True when any listed org ids subscribe to audit SIEM (for tests/helpers). */
export async function organizationSubscribesToAuditSiem(
  db: D1Client,
  organizationId: string
): Promise<boolean> {
  const rows = await db
    .select({ events: webhooks.events })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.status, "active")
      )
    );
  return rows.some((row) => orgWantsAuditSiem(row.events));
}
