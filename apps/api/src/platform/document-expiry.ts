/**
 * Atomic document-expiry helpers (SEA-63).
 * Document + pending recipients flip to expired with audit in one D1 batch.
 */

import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { D1Client } from "../global/db.js";
import { auditLogs, documents, recipients } from "../global/schema.js";
import { buildAuditLogValues } from "./audit-log.js";

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
    db.insert(auditLogs).values(
      buildAuditLogValues({
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
      })
    ),
    ...recipientAuditIds.map(({ recipientId, auditId }) =>
      db.insert(auditLogs).values(
        buildAuditLogValues({
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
        })
      )
    ),
  ];

  const [head, ...rest] = batch;
  if (!head) {
    return false;
  }

  const results = await db.batch([head, ...rest]);
  const updatedDocs = results[0] as Array<{ id: string }>;

  if (!updatedDocs || updatedDocs.length === 0) {
    const cleanup: BatchItem<"sqlite">[] = [
      db.delete(auditLogs).where(eq(auditLogs.id, documentAuditId)),
      ...recipientAuditIds.map(({ auditId }) =>
        db.delete(auditLogs).where(eq(auditLogs.id, auditId))
      ),
    ];
    const [cleanupHead, ...cleanupRest] = cleanup;
    if (cleanupHead) {
      await db.batch([cleanupHead, ...cleanupRest]);
    }
    return false;
  }

  return true;
}
