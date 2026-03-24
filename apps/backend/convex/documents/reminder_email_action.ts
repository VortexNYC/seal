/**
 * Reminder Email Actions
 *
 * Handles sending reminder emails to recipients.
 * These are actions (not mutations) because they call external email service.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { sendReminder } from "./email";

function hasRecipientCompleted(status: Doc<"document_recipients">["status"]): boolean {
  return status === "signed" || status === "approved" || status === "declined";
}

async function updateReminderAsFailed(
  ctx: ActionCtx,
  reminderId: Doc<"document_reminders">["_id"],
  error: string,
): Promise<void> {
  await ctx.runMutation(internal.documents.reminder_email_action.updateReminderStatus, {
    reminderId,
    status: "failed",
    failedAt: Date.now(),
    lastError: error,
  });
}

async function buildReminderEmailContext(
  ctx: ActionCtx,
  document: Doc<"documents">,
  recipient: Doc<"document_recipients">,
) {
  const owner: Doc<"users"> | null = await ctx.runQuery(
    internal.documents.reminder_email_action.getDocumentOwner,
    { ownerId: document.ownerId },
  );

  const brandingSettings = await ctx.runQuery(
    internal.organizations.queries.getBrandingSettingsInternal,
    { organizationId: document.organizationId },
  );

  return {
    senderName: owner?.name || owner?.email || "Document Owner",
    signingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5180"}/sign/${recipient.signingToken}`,
    emailBranding: brandingSettings.enabled
      ? {
          emailFromName: brandingSettings.emailFromName,
          emailReplyTo: brandingSettings.emailReplyTo,
        }
      : undefined,
  };
}

/**
 * Internal query to get reminder by ID
 */
export const getReminderById = internalQuery({
  args: { reminderId: v.id("document_reminders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reminderId);
  },
});

/**
 * Internal query to get document by ID
 */
export const getDocumentById = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

/**
 * Internal query to get recipient by ID
 */
export const getRecipientById = internalQuery({
  args: { recipientId: v.id("document_recipients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipientId);
  },
});

/**
 * Internal query to get document owner
 */
export const getDocumentOwner = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ownerId);
  },
});

/**
 * Internal mutation to update reminder status
 */
export const updateReminderStatus = internalMutation({
  args: {
    reminderId: v.id("document_reminders"),
    status: v.union(
      v.literal("pending"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    attemptCount: v.optional(v.number()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reminderId, ...updates } = args;
    await ctx.db.patch(reminderId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal action to send reminder email
 * This is called by the scheduler after processReminder validates the reminder
 */
export const sendReminderEmail = internalAction({
  args: {
    reminderId: v.id("document_reminders"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> => {
    // 1. Get the reminder
    const reminder: Doc<"document_reminders"> | null = await ctx.runQuery(
      internal.documents.reminder_email_action.getReminderById,
      { reminderId: args.reminderId },
    );

    if (!reminder) {
      return { success: false, error: "Reminder not found" };
    }

    // 2. Check if reminder should be sent
    if (reminder.status === "cancelled") {
      return { success: true }; // Already cancelled, nothing to do
    }

    if (reminder.status === "sent") {
      return { success: true }; // Already sent
    }

    // 3. Get the document
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.reminder_email_action.getDocumentById,
      { documentId: reminder.documentId },
    );

    if (!document || document.status === "deleted") {
      await updateReminderAsFailed(ctx, args.reminderId, "Document not found or deleted");
      return { success: false, error: "Document not found" };
    }

    // 4. Get recipient (if specific recipient)
    if (!reminder.recipientId) {
      await updateReminderAsFailed(ctx, args.reminderId, "No recipient specified for reminder");
      return { success: false, error: "No recipient specified" };
    }

    const recipient: Doc<"document_recipients"> | null = await ctx.runQuery(
      internal.documents.reminder_email_action.getRecipientById,
      { recipientId: reminder.recipientId },
    );

    if (!recipient) {
      await updateReminderAsFailed(ctx, args.reminderId, "Recipient not found");
      return { success: false, error: "Recipient not found" };
    }

    // 5. Check if recipient has already completed action
    if (hasRecipientCompleted(recipient.status)) {
      await ctx.runMutation(internal.documents.reminder_email_action.updateReminderStatus, {
        reminderId: args.reminderId,
        status: "cancelled",
        cancelledAt: Date.now(),
      });
      return { success: true }; // Not an error, just no longer needed
    }

    const { senderName, signingUrl, emailBranding } = await buildReminderEmailContext(
      ctx,
      document,
      recipient,
    );

    // 9. Send the email
    const result = await sendReminder(ctx, {
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: document.name,
      senderName,
      signingUrl,
      customMessage: reminder.customMessage,
      reminderCount: (reminder.attemptCount || 0) + 1,
      branding: emailBranding,
    });

    // 9. Update reminder status based on result
    if (result.success) {
      await ctx.runMutation(internal.documents.reminder_email_action.updateReminderStatus, {
        reminderId: args.reminderId,
        status: "sent",
        sentAt: Date.now(),
        messageId: result.messageId,
      });
    } else {
      const currentReminder = await ctx.runQuery(
        internal.documents.reminder_email_action.getReminderById,
        { reminderId: args.reminderId },
      );

      await ctx.runMutation(internal.documents.reminder_email_action.updateReminderStatus, {
        reminderId: args.reminderId,
        status: "failed",
        failedAt: Date.now(),
        lastError: result.error,
        attemptCount: (currentReminder?.attemptCount || 0) + 1,
      });
    }

    return result;
  },
});

/**
 * Internal action to send a reminder email directly to a recipient.
 * Used by the REST API where we don't need a document_reminders record.
 * Looks up document/recipient/owner data and sends the email.
 */
export const sendReminderEmailDirect = internalAction({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get document
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.reminder_email_action.getDocumentById,
      { documentId: args.documentId },
    );

    if (!document || document.status === "deleted") return;

    // Get recipient
    const recipient: Doc<"document_recipients"> | null = await ctx.runQuery(
      internal.documents.reminder_email_action.getRecipientById,
      { recipientId: args.recipientId },
    );

    if (!recipient) return;

    // Skip if recipient already completed
    if (hasRecipientCompleted(recipient.status)) {
      return;
    }

    const { senderName, signingUrl, emailBranding } = await buildReminderEmailContext(
      ctx,
      document,
      recipient,
    );

    await sendReminder(ctx, {
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: document.name,
      senderName,
      signingUrl,
      customMessage: args.customMessage,
      branding: emailBranding,
    });
  },
});
