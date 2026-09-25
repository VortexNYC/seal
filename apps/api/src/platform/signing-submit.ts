/**
 * Atomic signing-submit helpers (SEA-63).
 * Recipient status + legal evidence commit in one D1 batch.
 *
 * D1 `db.batch()` is the atomic unit (no interactive BEGIN in production).
 * A 0-row UPDATE is still "success", so subsequent INSERTs would otherwise
 * commit as orphans — we compensate by deleting the known IDs we just wrote
 * when the first-writer-wins UPDATE matched nothing.
 */

import { and, eq, notInArray, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { D1Client } from "../global/db.js";
import {
  activity,
  auditLogs,
  recipients,
  signatures,
} from "../global/schema.js";
import { buildAuditLogValues, type AuditLogInput } from "./audit-log.js";

export const TERMINAL_RECIPIENT_STATUSES = [
  "signed",
  "approved",
  "declined",
] as const;

export class RecipientAlreadyCompletedError extends Error {
  constructor() {
    super("Recipient has already completed");
    this.name = "RecipientAlreadyCompletedError";
  }
}

export type SigningSubmitBatchInput = {
  recipientId: string;
  recipientUpdate: Partial<typeof recipients.$inferInsert>;
  extraWhere?: SQL;
  audit: AuditLogInput & { id: string };
  signature?: {
    id: string;
    documentId: string;
    recipientId: string;
    value?: string;
    signatureMethod?: string;
    ipAddress?: string;
    userAgent?: string;
    signedAt: Date;
  };
  activityRow?: {
    id: string;
    organizationId: string;
    action: string;
    actorName: string;
    targetName: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
  };
};

/**
 * First-writer-wins recipient update + audit (+ optional signature/activity)
 * in one D1 batch. Losers throw RecipientAlreadyCompletedError after
 * compensating any evidence rows the batch still wrote.
 */
export async function commitSigningSubmit(
  db: D1Client,
  input: SigningSubmitBatchInput
): Promise<void> {
  const where = and(
    eq(recipients.id, input.recipientId),
    notInArray(recipients.status, [...TERMINAL_RECIPIENT_STATUSES]),
    input.extraWhere
  );

  const updateQuery = db
    .update(recipients)
    .set(input.recipientUpdate)
    .where(where)
    .returning({ id: recipients.id });

  const auditQuery = db
    .insert(auditLogs)
    .values(buildAuditLogValues(input.audit));

  const queries: BatchItem<"sqlite">[] = [updateQuery, auditQuery];

  if (input.signature) {
    queries.push(
      db.insert(signatures).values({
        id: input.signature.id,
        documentId: input.signature.documentId,
        recipientId: input.signature.recipientId,
        value: input.signature.value,
        signatureMethod: input.signature.signatureMethod,
        ipAddress: input.signature.ipAddress,
        userAgent: input.signature.userAgent,
        signedAt: input.signature.signedAt,
        createdAt: input.signature.signedAt,
        updatedAt: input.signature.signedAt,
      })
    );
  }

  if (input.activityRow) {
    queries.push(
      db.insert(activity).values({
        id: input.activityRow.id,
        organizationId: input.activityRow.organizationId,
        action: input.activityRow.action,
        actorName: input.activityRow.actorName,
        targetName: input.activityRow.targetName,
        metadata: JSON.stringify(input.activityRow.metadata),
        createdAt: input.activityRow.createdAt,
      })
    );
  }

  const [updateQueryHead, ...rest] = queries;
  if (!updateQueryHead) {
    throw new Error("commitSigningSubmit: empty batch");
  }

  const results = await db.batch([updateQueryHead, ...rest]);
  const updated = results[0] as Array<{ id: string }>;

  if (!updated || updated.length === 0) {
    await compensateLostRace(db, input);
    throw new RecipientAlreadyCompletedError();
  }
}

async function compensateLostRace(
  db: D1Client,
  input: SigningSubmitBatchInput
): Promise<void> {
  const cleanup: BatchItem<"sqlite">[] = [
    db.delete(auditLogs).where(eq(auditLogs.id, input.audit.id)),
  ];

  if (input.signature) {
    cleanup.push(
      db.delete(signatures).where(eq(signatures.id, input.signature.id))
    );
  }

  if (input.activityRow) {
    cleanup.push(
      db.delete(activity).where(eq(activity.id, input.activityRow.id))
    );
  }

  const [head, ...rest] = cleanup;
  if (!head) {
    return;
  }
  await db.batch([head, ...rest]);
}
