/**
 * Document reminder queries
 */

import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { authQuery } from "../auth";
import { verifyDocumentOwnership } from "./recipient_helpers";

/**
 * Get all reminders for a document
 * Includes filters for status and type
 */
export const getDocumentReminders = authQuery({
  args: {
    documentId: v.id("documents"),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("pending"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
    type: v.optional(v.union(v.literal("manual"), v.literal("automated"))),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // Build query with status filter if provided
    let reminders: Doc<"document_reminders">[];
    if (args.status) {
      const status = args.status; // TypeScript needs this to be non-optional
      reminders = await ctx.db
        .query("document_reminders")
        .withIndex("by_document_status", (q) =>
          q.eq("documentId", args.documentId).eq("status", status),
        )
        .collect();
    } else {
      reminders = await ctx.db
        .query("document_reminders")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .collect();
    }

    // Filter by type if provided
    const filteredReminders = args.type ? reminders.filter((r) => r.type === args.type) : reminders;

    // Enrich with recipient data
    const enrichedReminders = await Promise.all(
      filteredReminders.map(async (reminder) => {
        let recipientInfo = null;
        if (reminder.recipientId) {
          const recipient = await ctx.db.get(reminder.recipientId);
          if (recipient) {
            recipientInfo = {
              email: recipient.email,
              name: recipient.name,
              role: recipient.role,
              status: recipient.status,
            };
          }
        }

        return {
          ...reminder,
          recipient: recipientInfo,
        };
      }),
    );

    // Sort by scheduled time (most recent first)
    return enrichedReminders.sort((a, b) => b.scheduledFor - a.scheduledFor);
  },
});

/**
 * Get reminders for a specific recipient
 */
export const getRecipientReminders = authQuery({
  args: {
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Get recipient to verify access
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new Error("Recipient not found");
    }

    // Verify ownership of the document
    await verifyDocumentOwnership(ctx, recipient.documentId, userId);

    // Get all reminders for this recipient
    const reminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .collect();

    // Sort by scheduled time (most recent first)
    return reminders.sort((a, b) => b.scheduledFor - a.scheduledFor);
  },
});

/**
 * Get reminder history (sent/failed) for a document
 * Useful for showing what reminders have been sent
 */
export const getReminderHistory = authQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // Get sent and failed reminders
    const reminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Filter to only sent/failed reminders
    const history = reminders.filter((r) => r.status === "sent" || r.status === "failed");

    // Sort by sent/failed time (most recent first)
    const sorted = history.sort((a, b) => {
      const timeA = a.sentAt || a.failedAt || a.scheduledFor;
      const timeB = b.sentAt || b.failedAt || b.scheduledFor;
      return timeB - timeA;
    });

    // Apply limit if provided
    const limited = args.limit ? sorted.slice(0, args.limit) : sorted;

    // Enrich with recipient data
    return await Promise.all(
      limited.map(async (reminder) => {
        let recipientInfo = null;
        if (reminder.recipientId) {
          const recipient = await ctx.db.get(reminder.recipientId);
          if (recipient) {
            recipientInfo = {
              email: recipient.email,
              name: recipient.name,
              role: recipient.role,
            };
          }
        }

        return {
          ...reminder,
          recipient: recipientInfo,
        };
      }),
    );
  },
});

/**
 * Get reminder statistics for a document
 */
export const getReminderStats = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // Get all reminders
    const reminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Calculate statistics
    const stats = {
      total: reminders.length,
      scheduled: reminders.filter((r) => r.status === "scheduled").length,
      pending: reminders.filter((r) => r.status === "pending").length,
      sent: reminders.filter((r) => r.status === "sent").length,
      failed: reminders.filter((r) => r.status === "failed").length,
      cancelled: reminders.filter((r) => r.status === "cancelled").length,
      manual: reminders.filter((r) => r.type === "manual").length,
      automated: reminders.filter((r) => r.type === "automated").length,
      lastSentAt: reminders
        .filter((r) => r.sentAt)
        .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))[0]?.sentAt,
    };

    return stats;
  },
});

/**
 * Check if recipient can be reminded
 * Used to show/hide reminder buttons in UI
 */
export const canRemindRecipient = authQuery({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // Get recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient || recipient.documentId !== args.documentId) {
      return {
        canRemind: false,
        reason: "Recipient not found or doesn't belong to document",
      };
    }

    // Check if recipient has completed their action
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      return {
        canRemind: false,
        reason: `Recipient has already ${recipient.status}`,
      };
    }

    // Check if there's a recent pending/scheduled reminder
    const recentReminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .collect();

    const hasRecentPending = recentReminders.some(
      (r) =>
        (r.status === "pending" || r.status === "scheduled") &&
        r.scheduledFor > Date.now() - 24 * 60 * 60 * 1000, // Within last 24 hours
    );

    if (hasRecentPending) {
      return {
        canRemind: false,
        reason: "A reminder was recently sent or is scheduled",
      };
    }

    return {
      canRemind: true,
      reason: null,
    };
  },
});
