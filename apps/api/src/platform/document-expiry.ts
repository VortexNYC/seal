/**
 * Atomic document-expiry helpers (SEA-63 + SEA-44).
 * Document + pending recipients flip to expired with sealed audit in one D1 batch.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { D1Client } from "../global/db.js";
import { auditLogs, documents, recipients } from "../global/schema.js";
import {
  buildAuditChainTipBatchItems,
  buildAuditChainTipRevertBatchItems,
} from "./audit-chain.js";
import { prepareChainedAuditLogBatch } from "./audit-log.js";

export const SCHEDULER_ACTOR = {
  type: "agent" as const,
  id: "system:scheduled",
};

export type DocumentExpiryInput = {
  documentId: string;
  organizationId: string;
  publicId: string;
  deadline: Date | null;
  pendingRecipientIds: string[];
  now?: Date;
};

/**
 * First-writer-wins document expiry + recipient.expired / document.expired
 * audits in one batch. Returns false when another writer already expired the
 * document (lost race — evidence rows compensated).
 */
export async function commitDocumentExpiry(
  db: D1Client,
  input: DocumentExpiryInput
): Promise<boolean> {
  const now = input.now ?? new Date();
  const documentAuditId = crypto.randomUUID();
  const recipientAuditIds = input.pendingRecipientIds.map((recipientId) => ({
    recipientId,
    auditId: crypto.randomUUID(),
  }));

  const auditInputs = [
    {
      id: documentAuditId,
      organizationId: input.organizationId,
      actor: SCHEDULER_ACTOR,
      action: "document.expired",
      resourceType: "document",
      resourceId: input.documentId,
      metadata: {
        publicId: input.publicId,
        deadline: input.deadline?.getTime() ?? null,
        pendingRecipientCount: input.pendingRecipientIds.length,
      },
      createdAt: now,
    },
    ...recipientAuditIds.map(({ recipientId, auditId }) => ({
      id: auditId,
      organizationId: input.organizationId,
      actor: SCHEDULER_ACTOR,
      action: "recipient.expired",
      resourceType: "recipient",
      resourceId: recipientId,
      metadata: {
        documentId: input.documentId,
        publicId: input.publicId,
      },
      createdAt: now,
    })),
  ];

  const chained = await prepareChainedAuditLogBatch(db, auditInputs);
  if (!chained) {
    return false;
  }

  const tipItems = buildAuditChainTipBatchItems(db, {
    organizationId: input.organizationId,
    prevHash: chained.tipPrevHash,
    entryHash: chained.tipEntryHash,
    sequence: chained.tipSequence,
    hadTipRow: chained.hadTipRow,
  });
  const tipHead = tipItems[0];
  if (!tipHead) {
    throw new Error("commitDocumentExpiry: missing tip statement");
  }

  const batch: BatchItem<"sqlite">[] = [
    db
      .update(documents)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(eq(documents.id, input.documentId), eq(documents.status, "sent"))
      )
      .returning({ id: documents.id }),
    db
      .update(recipients)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(recipients.documentId, input.documentId),
          eq(recipients.status, "pending")
        )
      ),
    ...chained.prepared.map((row) =>
      db.insert(auditLogs).values(row.values)
    ),
    tipHead,
  ];

  const [head, ...rest] = batch;
  if (!head) {
    return false;
  }

  let results: unknown[];
  try {
    results = await db.batch([head, ...rest]);
  } catch {
    await compensateExpiry(db, {
      documentAuditId,
      recipientAuditIds,
      chained,
      organizationId: input.organizationId,
      revertTip: false,
    });
    return false;
  }

  const updatedDocs = results[0] as Array<{ id: string }>;
  const tipIdx = 2 + chained.prepared.length;
  const tipResult = results[tipIdx] as Array<{ organizationId: string }>;
  const docWon = Boolean(updatedDocs && updatedDocs.length > 0);
  const tipWon = Boolean(tipResult && tipResult.length > 0);

  if (docWon && tipWon) {
    return true;
  }

  await compensateExpiry(db, {
    documentAuditId,
    recipientAuditIds,
    chained,
    organizationId: input.organizationId,
    revertTip: tipWon,
  });

  if (docWon && !tipWon) {
    // Tip lost after doc expired — restore document + pending recipients.
    const restore: BatchItem<"sqlite">[] = [
      db
        .update(documents)
        .set({ status: "sent", updatedAt: now })
        .where(eq(documents.id, input.documentId)),
    ];
    if (input.pendingRecipientIds.length > 0) {
      restore.push(
        db
          .update(recipients)
          .set({ status: "pending", updatedAt: now })
          .where(
            and(
              eq(recipients.documentId, input.documentId),
              inArray(recipients.id, input.pendingRecipientIds)
            )
          )
      );
    }
    const [restoreHead, ...restoreRest] = restore;
    if (restoreHead) {
      await db.batch([restoreHead, ...restoreRest]);
    }
  }

  return false;
}

async function compensateExpiry(
  db: D1Client,
  params: {
    documentAuditId: string;
    recipientAuditIds: Array<{ recipientId: string; auditId: string }>;
    organizationId: string;
    chained: NonNullable<
      Awaited<ReturnType<typeof prepareChainedAuditLogBatch>>
    >;
    revertTip: boolean;
  }
): Promise<void> {
  const cleanup: BatchItem<"sqlite">[] = [
    db.delete(auditLogs).where(eq(auditLogs.id, params.documentAuditId)),
    ...params.recipientAuditIds.map(({ auditId }) =>
      db.delete(auditLogs).where(eq(auditLogs.id, auditId))
    ),
  ];

  if (params.revertTip) {
    cleanup.push(
      ...buildAuditChainTipRevertBatchItems(db, {
        organizationId: params.organizationId,
        prevHash: params.chained.tipPrevHash,
        entryHash: params.chained.tipEntryHash,
        hadTipRow: params.chained.hadTipRow,
        sequence: params.chained.tipSequence,
      })
    );
  }

  const [cleanupHead, ...cleanupRest] = cleanup;
  if (cleanupHead) {
    await db.batch([cleanupHead, ...cleanupRest]);
  }
}
