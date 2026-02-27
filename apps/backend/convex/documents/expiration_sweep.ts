/**
 * Document Expiration Sweep
 *
 * Cron-driven mutation that runs every 15 minutes to:
 * 1. Find recipients whose expiresAt has passed and mark them as "expired"
 * 2. Transition documents to "expired" when all recipients are terminal and at least one expired
 * 3. Send notification emails to document owners
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { logAction } from "../audit_logs/helpers";
import { isRecipientTerminal } from "../schemas/document_recipients";
import { sendDocumentExpiredNotification } from "./email";

const BATCH_LIMIT = 100;

/**
 * Sweep expired recipients and transition documents.
 * Runs every 15 minutes via cron.
 */
export const sweepExpiredRecipients = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Query active documents (sent / in_progress) that could have expired recipients
    const sentDocs = await ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) => q.eq("workflowStatus", "sent"))
      .collect();
    const inProgressDocs = await ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) => q.eq("workflowStatus", "in_progress"))
      .collect();

    const activeDocs = [...sentDocs, ...inProgressDocs].filter(
      (doc) => doc.status !== "deleted" && doc.organizationId,
    );

    let recipientsExpired = 0;
    let documentsExpired = 0;

    for (const doc of activeDocs) {
      if (recipientsExpired >= BATCH_LIMIT) break;

      // Get all recipients for this document
      const recipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      // Find recipients that need to be expired
      const toExpire = recipients.filter(
        (r) =>
          (r.status === "pending" || r.status === "viewed") &&
          r.expiresAt !== undefined &&
          r.expiresAt < now &&
          r.expirationNotifiedAt === undefined,
      );

      if (toExpire.length === 0) continue;

      // Expire each qualifying recipient
      for (const recipient of toExpire) {
        if (recipientsExpired >= BATCH_LIMIT) break;

        await ctx.db.patch(recipient._id, {
          status: "expired",
          expirationNotifiedAt: now,
        });

        // Log recipient.expired audit event
        await logAction(ctx, {
          organizationId: doc.organizationId,
          actorType: "system",
          action: "recipient.expired",
          resourceType: "recipient",
          resourceId: recipient._id,
          documentId: doc._id,
          recipientId: recipient._id,
          newValues: { status: "expired", expiresAt: recipient.expiresAt },
          metadata: {
            description: "Recipient expired due to document deadline",
            source: "cron",
          },
          ipAddress: "0.0.0.0",
        });

        recipientsExpired++;
      }

      // Re-check all recipients after expiring (some may have been updated above)
      const updatedRecipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      const allTerminal =
        updatedRecipients.length > 0 &&
        updatedRecipients.every((r) => isRecipientTerminal(r.status));
      const hasExpired = updatedRecipients.some((r) => r.status === "expired");

      if (allTerminal && hasExpired) {
        // Transition document to expired
        await ctx.db.patch(doc._id, {
          workflowStatus: "expired",
          expiredAt: now,
        });

        // Log document.expired audit event
        await logAction(ctx, {
          organizationId: doc.organizationId,
          actorType: "system",
          action: "document.expired",
          resourceType: "document",
          resourceId: doc._id,
          documentId: doc._id,
          newValues: { workflowStatus: "expired", expiredAt: now },
          metadata: {
            description:
              "Document expired — all recipients are in terminal state with at least one expired",
            source: "cron",
          },
          ipAddress: "0.0.0.0",
        });

        // Schedule notification email to owner
        await ctx.scheduler.runAfter(0, internal.documents.expiration_sweep.notifyDocumentExpired, {
          documentId: doc._id,
        });

        documentsExpired++;
      }
    }

    if (recipientsExpired > 0 || documentsExpired > 0) {
      console.info(
        `Expiration sweep: ${recipientsExpired} recipients expired, ${documentsExpired} documents transitioned`,
      );
    }

    return {
      recipientsExpired,
      documentsExpired,
    };
  },
});

/**
 * Send expired notification email to document owner.
 * Scheduled by sweepExpiredRecipients after a document transitions to expired.
 */
export const notifyDocumentExpired = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    // Get document
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });

    if (!document) {
      console.error(`notifyDocumentExpired: Document ${args.documentId} not found`);
      return;
    }

    // Get owner info
    const owner = await ctx.runQuery(internal.organizations.helpers.getUserById, {
      userId: document.ownerId,
    });

    if (!owner?.email) {
      console.error(`notifyDocumentExpired: Owner not found for document ${args.documentId}`);
      return;
    }

    const result = await sendDocumentExpiredNotification({
      to: owner.email,
      ownerName: owner.name || owner.email,
      documentName: document.name,
      expiredAt: document.expiredAt ?? Date.now(),
    });

    if (!result.success) {
      console.error(
        `Failed to send expired notification for document ${args.documentId}:`,
        result.error,
      );
    }
  },
});
