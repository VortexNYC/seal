/**
 * Cancellation Email Action
 *
 * Sends cancellation notification emails to recipients when a document is voided.
 * This is an internalAction because it calls the external Resend email service.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { sendCancellationNotification } from "./email";

/**
 * Internal action to notify all pending recipients that a document has been cancelled.
 * Scheduled from the API voidDocument mutation.
 */
export const sendCancellationEmails = internalAction({
  args: {
    documentId: v.id("documents"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get document
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId },
    );

    if (!document) return;

    // Get recipients
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );

    if (recipients.length === 0) return;

    // Get sender information
    const senderUser = await ctx.runQuery(internal.organizations.helpers.getUserById, {
      userId: document.ownerId,
    });
    const senderName = senderUser?.name ?? senderUser?.email ?? "Seal User";

    // Notify all recipients who haven't completed their action
    for (const recipient of recipients) {
      if (recipient.status === "signed" || recipient.status === "approved") {
        // Still notify signed/approved recipients that the document was cancelled
      }
      if (recipient.status === "declined") {
        continue; // Already declined, no need to notify
      }

      await sendCancellationNotification(ctx, {
        to: recipient.email,
        recipientName: recipient.name || recipient.email,
        documentName: document.name,
        senderName,
        reason: args.reason,
      });
    }
  },
});
