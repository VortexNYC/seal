/**
 * Document Viewed Notification
 *
 * Sends a notification email to the document owner when a recipient
 * first views the document, if enabled in org notification settings.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { sendDocumentViewed } from "./email";

/**
 * Send viewed notification to document owner.
 * Called when a recipient first opens the signing page.
 */
export const sendViewedNotification = internalAction({
  args: {
    recipientId: v.id("document_recipients"),
    documentId: v.id("documents"),
    viewedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Get recipient info
    const recipient = await ctx.runQuery(
      internal.documents.recipient_email_action.getRecipientById,
      { recipientId: args.recipientId },
    );
    if (!recipient) return { success: false, error: "Recipient not found" };

    // 2. Get document
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });
    if (!document) return { success: false, error: "Document not found" };

    // 3. Check org notification settings
    if (document.organizationId) {
      const notificationSettings = await ctx.runQuery(
        internal.organizations.queries.getNotificationSettingsInternal,
        { organizationId: document.organizationId },
      );

      // Opt-out: sendViewedNotification defaults to true
      if (notificationSettings.sendViewedNotification === false) {
        return { success: false, error: "Viewed notifications disabled" };
      }
    }

    // 4. Get document owner
    const owner = await ctx.runQuery(internal.organizations.helpers.getUserById, {
      userId: document.ownerId,
    });
    if (!owner?.email) return { success: false, error: "Owner email not found" };

    // 5. Send email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
    const documentUrl = `${baseUrl}/documents/${args.documentId}`;

    const result = await sendDocumentViewed({
      to: owner.email,
      ownerName: owner.name || owner.email,
      documentName: document.name,
      documentUrl,
      recipientName: recipient.name || recipient.email,
      recipientEmail: recipient.email,
      viewedAt: args.viewedAt,
    });

    if (!result.success) {
      console.error("Failed to send viewed notification:", result.error);
    }

    return result;
  },
});
