/**
 * Atomic signing-submit helpers (SEA-63 + SEA-44).
 * Recipient status + sealed audit evidence commit in one D1 batch.
 *
 * D1 `db.batch()` is the atomic unit (no interactive BEGIN in production).
 * A 0-row UPDATE is still "success", so subsequent INSERTs would otherwise
 * commit as orphans — we compensate by deleting the known IDs we just wrote
 * when the first-writer-wins UPDATE matched nothing. Tip advances use the
 * same pattern (WHERE tip_hash = prev).
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
import {
  AuditChainConflictError,
  buildAuditChainTipRevertBatchItems,
} from "./audit-chain.js";
import {
  prepareChainedAuditLog,
  tipBatchItemsForPrepared,
  type AuditLogInput,
  type PreparedAuditLog,
} from "./audit-log.js";

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
  /** Status to restore if tip lost after recipient update (SEA-44). */
  previousStatus: string;
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
 * First-writer-wins recipient update + sealed audit (+ optional signature/activity)
 * in one D1 batch. Losers throw RecipientAlreadyCompletedError after
 * compensating any evidence rows the batch still wrote.
 */
export async function commitSigningSubmit(
  db: D1Client,
  input: SigningSubmitBatchInput
): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prepared = await prepareChainedAuditLog(db, input.audit);
    const outcome = await attemptSigningSubmitBatch(db, input, prepared);
    if (outcome === "ok") {
      return;
    }
    if (outcome === "recipient_lost") {
      throw new RecipientAlreadyCompletedError();
    }
    // tip_lost — orphan cleaned; retry with fresh tip
  }
  throw new AuditChainConflictError();
}

async function attemptSigningSubmitBatch(
  db: D1Client,
  input: SigningSubmitBatchInput,
  prepared: PreparedAuditLog
): Promise<"ok" | "recipient_lost" | "tip_lost"> {
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

  const tipItems = tipBatchItemsForPrepared(db, {
    organizationId: prepared.values.organizationId,
    prevHash: prepared.prevHash,
    entryHash: prepared.entryHash,
    sequence: prepared.sequence,
    hadTipRow: prepared.hadTipRow,
  });
  const tipHead = tipItems[0];
  if (!tipHead) {
    throw new Error("commitSigningSubmit: missing tip statement");
  }

  const queries: BatchItem<"sqlite">[] = [
    updateQuery,
    db.insert(auditLogs).values(prepared.values),
    tipHead,
  ];

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

  let results: unknown[];
  try {
    results = await db.batch([updateQueryHead, ...rest]);
  } catch {
    // Tip insert unique race — nothing committed if batch rolled back; still
    // best-effort delete in case partial writes ever surface.
    await compensateLostRace(db, input, prepared, {
      revertTip: false,
      revertRecipient: false,
    });
    return "tip_lost";
  }

  const updated = results[0] as Array<{ id: string }>;
  const tipResult = results[2] as Array<{ organizationId: string }>;
  const recipientWon = Boolean(updated && updated.length > 0);
  const tipWon = Boolean(tipResult && tipResult.length > 0);

  if (recipientWon && tipWon) {
    return "ok";
  }

  if (!recipientWon) {
    await compensateLostRace(db, input, prepared, {
      revertTip: tipWon,
      revertRecipient: false,
    });
    return "recipient_lost";
  }

  // Tip lost after recipient won — revert recipient + drop orphan sealed row.
  await compensateLostRace(db, input, prepared, {
    revertTip: tipWon,
    revertRecipient: true,
  });
  return "tip_lost";
}

async function compensateLostRace(
  db: D1Client,
  input: SigningSubmitBatchInput,
  prepared: PreparedAuditLog,
  opts: { revertTip: boolean; revertRecipient: boolean }
): Promise<void> {
  const cleanup: BatchItem<"sqlite">[] = [
    db.delete(auditLogs).where(eq(auditLogs.id, input.audit.id)),
  ];

  if (opts.revertTip) {
    cleanup.push(
      ...buildAuditChainTipRevertBatchItems(db, {
        organizationId: prepared.values.organizationId,
        prevHash: prepared.prevHash,
        entryHash: prepared.entryHash,
        hadTipRow: prepared.hadTipRow,
        sequence: prepared.sequence,
      })
    );
  }

  if (opts.revertRecipient) {
    cleanup.push(
      db
        .update(recipients)
        .set({
          status: input.previousStatus,
          signedAt: null,
          declinedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(recipients.id, input.recipientId))
    );
  }

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
