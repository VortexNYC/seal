/**
 * Resend Email Component
 *
 * Wraps @convex-dev/resend to provide email sending with built-in
 * queuing, batching, retry, idempotency, and delivery tracking.
 *
 * The `onEmailEvent` callback replicates ESIGN audit logging from the
 * old manual webhook handler — looking up the notification by Resend
 * message ID and writing to the audit trail.
 */

import { Resend } from "@convex-dev/resend";
import { vOnEmailEventArgs } from "@convex-dev/resend";
import { v } from "convex/values";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { logAction } from "../audit_logs/helpers";

export const resendComponent: Resend = new Resend(components.resend, {
  testMode: false,
  onEmailEvent: internal.emails.resend_component.handleEmailEvent,
});

/**
 * Handle email delivery events from Resend.
 *
 * Replicates the ESIGN audit logging from the old `resend_webhooks.ts`:
 * looks up the notification by Resend message ID to find the associated
 * document/org context, then writes an audit log entry.
 */
export const handleEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, args) => {
    const eventType = args.event.type;

    // Only audit delivery-related events
    const auditableEvents = ["email.delivered", "email.opened", "email.bounced"] as const;

    type AuditableEvent = (typeof auditableEvents)[number];

    if (!auditableEvents.includes(eventType as AuditableEvent)) {
      return;
    }

    const resendMessageId = "data" in args.event ? args.event.data.email_id : undefined;
    if (!resendMessageId) return;

    const recipientEmail =
      "data" in args.event
        ? Array.isArray(args.event.data.to)
          ? args.event.data.to[0]
          : args.event.data.to
        : undefined;

    // Look up the notification by Resend message ID (same as old webhook handler)
    const notification = await ctx.db
      .query("notifications")
      .withIndex("by_email_message_id", (q) => q.eq("emailMessageId", resendMessageId))
      .first();

    if (!notification) {
      console.warn(
        `[Resend Component] No notification found for message ${resendMessageId} (${eventType})`,
      );
      return;
    }

    // Extract IDs from the notification data
    const documentId =
      "documentId" in notification.data
        ? (notification.data.documentId as Id<"documents">)
        : undefined;
    const recipientId =
      "recipientId" in notification.data
        ? (notification.data.recipientId as Id<"document_recipients">)
        : undefined;

    // Extract bounce info if applicable
    const bounceType =
      eventType === "email.bounced" && "data" in args.event
        ? (args.event.data as { bounce?: { type?: string } }).bounce?.type
        : undefined;

    await logAction(ctx, {
      organizationId: notification.organizationId,
      actorType: "system",
      action: eventType as AuditableEvent,
      resourceType: "email",
      resourceId: resendMessageId,
      documentId,
      recipientId,
      newValues: bounceType ? { bounceType } : undefined,
      metadata: {
        description: `Email ${eventType.split(".")[1]} to ${recipientEmail ?? "unknown"}`,
        source: "resend_component",
      },
      ipAddress: "webhook",
    });
  },
});

/**
 * Record that an email was queued through the Resend component, with the
 * Resend message id and the recipient. Mirrors the audit shape produced by
 * `handleEmailEvent` for delivery events, so prod operators can trace an
 * email from "queued" through "delivered" / "opened" / "bounced" entirely
 * via the audit log. Called from action-side senders that can't write the
 * row directly.
 */
export const logEmailQueued = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    messageId: v.string(),
    to: v.string(),
    subject: v.string(),
    documentId: v.optional(v.id("documents")),
    recipientId: v.optional(v.id("document_recipients")),
  },
  handler: async (ctx, args) => {
    await logAction(ctx, {
      organizationId: args.organizationId,
      actorType: "system",
      actorId: "resend_component",
      action: "email.queued",
      resourceType: "email",
      resourceId: args.messageId,
      documentId: args.documentId,
      recipientId: args.recipientId,
      newValues: { to: args.to, subject: args.subject },
      metadata: {
        description: `Email queued to ${args.to}: ${args.subject}`,
        source: "resend_component",
      },
      ipAddress: "system",
    });
  },
});

/**
 * Clean up old email records from the resend component.
 * Scheduled via cron to run hourly.
 */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const cleanupResendEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {
      olderThan: ONE_WEEK_MS,
    });
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupAbandonedEmails, {
      olderThan: 4 * ONE_WEEK_MS,
    });
  },
});
