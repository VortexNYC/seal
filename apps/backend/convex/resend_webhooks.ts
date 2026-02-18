/**
 * Resend Webhook Handlers
 *
 * Processes email delivery events from Resend (delivered, opened, bounced).
 * Logs delivery confirmations to the audit trail for ESIGN compliance.
 *
 * Setup in Resend Dashboard:
 * 1. Go to Webhooks → Add Webhook
 * 2. URL: https://<deployment>.convex.site/resend-webhooks
 * 3. Events: email.delivered, email.opened, email.bounced
 * 4. Copy the signing secret → set as RESEND_WEBHOOK_SECRET env var
 */

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { logAction } from "./audit_logs/helpers";

/**
 * Log an email delivery event to the audit trail.
 *
 * Looks up the notification by Resend message ID to find the associated
 * document and organization context, then writes an audit log entry.
 */
export const logEmailEvent = internalMutation({
  args: {
    resendMessageId: v.string(),
    eventType: v.union(
      v.literal("email.delivered"),
      v.literal("email.opened"),
      v.literal("email.bounced"),
    ),
    recipientEmail: v.string(),
    timestamp: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    bounceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find the notification with this Resend message ID to get document context
    const notification = await ctx.db
      .query("notifications")
      .withIndex("by_email_message_id", (q) => q.eq("emailMessageId", args.resendMessageId))
      .first();

    if (!notification) {
      console.warn(
        `[Resend Webhook] No notification found for message ${args.resendMessageId} (${args.eventType})`,
      );
      return;
    }

    // Extract documentId from the notification data (nested in data object)
    const documentId = "documentId" in notification.data
      ? (notification.data.documentId as Id<"documents"> | undefined)
      : undefined;

    // Extract recipientId if present
    const recipientId = "recipientId" in notification.data
      ? (notification.data.recipientId as Id<"document_recipients"> | undefined)
      : undefined;

    await logAction(ctx, {
      organizationId: notification.organizationId,
      actorType: "system",
      action: args.eventType,
      resourceType: "email",
      resourceId: args.resendMessageId,
      documentId,
      recipientId,
      newValues: args.bounceType ? { bounceType: args.bounceType } : undefined,
      metadata: {
        description: `Email ${args.eventType.split(".")[1]} to ${args.recipientEmail}`,
        source: "resend_webhook",
      },
      ipAddress: args.ipAddress ?? "webhook",
      userAgent: args.userAgent,
    });
  },
});
