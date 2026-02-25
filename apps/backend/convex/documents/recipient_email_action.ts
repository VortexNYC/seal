/**
 * Recipient Email Actions
 *
 * Handles sending emails after recipient actions (signing, approving, viewing).
 * These are actions (not mutations) because they call external email service.
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { isRecipientComplete } from "../schemas/document_recipients";
import { sendDocumentCompleted, sendSigningComplete } from "./email";

/**
 * Internal mutation to mark document as completed
 */
export const markDocumentAsCompleted = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // Only update if not already completed
    if (document.workflowStatus !== "completed") {
      const now = Date.now();
      const SEVEN_YEARS_MS = 7 * 365.25 * 24 * 60 * 60 * 1000;
      await ctx.db.patch(args.documentId, {
        workflowStatus: "completed",
        completedAt: now,
        updatedAt: now,
        retainUntil: now + SEVEN_YEARS_MS,
      });
    }

    return { success: true };
  },
});

/**
 * Internal query to get recipient by ID
 */
import { internalQuery } from "../_generated/server";

export const getRecipientById = internalQuery({
  args: { recipientId: v.id("document_recipients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipientId);
  },
});

/**
 * Send post-signature emails after a recipient completes their action
 *
 * This action is called after a recipient signs/approves/views a document.
 * It sends:
 * 1. Confirmation email to the recipient
 * 2. If all recipients are complete, notification email to the document owner
 */
export const sendPostSignatureEmails = internalAction({
  args: {
    recipientId: v.id("document_recipients"),
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    confirmationSent: boolean;
    completionEmailSent: boolean;
    documentCompleted: boolean;
    error?: string;
  }> => {
    // 1. Get the recipient who just completed
    const recipient: Doc<"document_recipients"> | null = await ctx.runQuery(
      internal.documents.recipient_email_action.getRecipientById,
      { recipientId: args.recipientId },
    );

    if (!recipient) {
      return {
        confirmationSent: false,
        completionEmailSent: false,
        documentCompleted: false,
        error: "Recipient not found",
      };
    }

    // 2. Get the document
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId },
    );

    if (!document) {
      return {
        confirmationSent: false,
        completionEmailSent: false,
        documentCompleted: false,
        error: "Document not found",
      };
    }

    // 3. Send confirmation email to the recipient
    let confirmationSent = false;
    const completedAt = recipient.signedAt || recipient.approvedAt || recipient.viewedAt;

    if (completedAt && isRecipientComplete(recipient.role, recipient.status)) {
      const confirmResult = await sendSigningComplete({
        to: recipient.email,
        recipientName: recipient.name || recipient.email,
        documentName: document.name,
        signedAt: completedAt,
        role: recipient.role,
      });
      confirmationSent = confirmResult.success;

      if (!confirmResult.success) {
        console.error("Failed to send confirmation email:", confirmResult.error);
      }
    }

    // 4. Get all recipients and check if all are complete
    const allRecipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );

    const allComplete = allRecipients.every((r) => isRecipientComplete(r.role, r.status));

    let completionEmailSent = false;

    if (allComplete) {
      // 5. Mark document as completed
      await ctx.runMutation(internal.documents.recipient_email_action.markDocumentAsCompleted, {
        documentId: args.documentId,
      });

      // 5b. Schedule certificate of completion generation (async, non-blocking)
      await ctx.scheduler.runAfter(
        0,
        internal.documents.certificate_of_completion.generateCertificate,
        { documentId: args.documentId },
      );

      // 6. Get document owner info
      const owner: Doc<"users"> | null = await ctx.runQuery(
        internal.organizations.helpers.getUserById,
        { userId: document.ownerId },
      );

      if (owner?.email) {
        // Build recipients summary
        const recipientsSummary = allRecipients
          .filter((r) => isRecipientComplete(r.role, r.status))
          .map((r) => ({
            name: r.name || r.email,
            email: r.email,
            role: r.role,
            completedAt: r.signedAt || r.approvedAt || r.viewedAt || Date.now(),
          }));

        // Generate time-limited download token for the owner
        const downloadToken = await ctx.runMutation(
          internal.documents.download_tokens.generateTokenInternal,
          { documentId: document._id, issuedTo: owner.email },
        );

        // Build document URL with secure download link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
        const convexSiteUrl = process.env.CONVEX_SITE_URL || baseUrl;
        const documentUrl = `${baseUrl}/documents/${document._id}`;
        const downloadUrl = `${convexSiteUrl}/download?token=${downloadToken}`;

        const completionResult = await sendDocumentCompleted({
          to: owner.email,
          senderName: owner.name || owner.email,
          documentName: document.name,
          documentUrl,
          downloadUrl,
          completedAt: Date.now(),
          recipientsSummary,
        });

        completionEmailSent = completionResult.success;

        if (!completionResult.success) {
          console.error("Failed to send completion email to owner:", completionResult.error);
        }
      }
    }

    return {
      confirmationSent,
      completionEmailSent,
      documentCompleted: allComplete,
    };
  },
});
