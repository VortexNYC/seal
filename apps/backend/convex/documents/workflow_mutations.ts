/**
 * Document workflow mutations
 * Handles document lifecycle: sending to recipients, tracking progress, completion
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { permissionMutation } from "../auth";
import { publishWebhookEvent } from "../webhooks/publish";
import { verifyDocumentOwnership } from "./recipient_helpers";

/**
 * Send document to recipients
 * Transitions document from draft to sent status and schedules automated reminders
 * Requires documents:edit permission
 */
export const sendDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    autoRemindAfterDays: v.optional(v.number()), // Optional: schedule automated reminder (e.g., 3 days)
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 3. Validate document can be sent
    // Document should have at least one recipient
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    if (recipients.length === 0) {
      throw new ConvexError("Document must have at least one recipient before sending");
    }

    // 4. Share document with recipients who have existing accounts
    let sharedWithCount = 0;
    for (const recipient of recipients) {
      // Look up user by email
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", recipient.email))
        .first();

      if (existingUser) {
        // Check if user is a member of the document's organization
        const orgMember = await ctx.db
          .query("organization_members")
          .withIndex("by_user_organization", (q) =>
            q.eq("userId", existingUser._id).eq("organizationId", document.organizationId),
          )
          .first();

        if (orgMember && orgMember.status === "active") {
          // Check if access already exists
          const existingAccess = await ctx.db
            .query("document_access")
            .withIndex("by_document_user", (q) =>
              q.eq("documentId", args.documentId).eq("userId", existingUser._id),
            )
            .first();

          // Only create access if it doesn't exist or was revoked
          if (!existingAccess || existingAccess.revokedAt !== undefined) {
            if (existingAccess) {
              // Reactivate revoked access
              await ctx.db.patch(existingAccess._id, {
                permissionLevel: "view",
                grantedBy: userId,
                grantedAt: Date.now(),
                revokedAt: undefined,
              });
            } else {
              // Create new access record
              await ctx.db.insert("document_access", {
                documentId: args.documentId,
                userId: existingUser._id,
                permissionLevel: "view",
                grantedBy: userId,
                grantedAt: Date.now(),
              });
            }
            sharedWithCount++;
          }
        }

        // Link the userId to the recipient record for easier tracking
        if (!recipient.userId) {
          await ctx.db.patch(recipient._id, {
            userId: existingUser._id,
            updatedAt: Date.now(),
          });
        }
      }
    }

    // 5. Update document status
    const now = Date.now();
    await ctx.db.patch(args.documentId, {
      status: "active",
      sentAt: now,
      updatedAt: now,
    });

    // 6. Schedule automated reminders if requested
    if (args.autoRemindAfterDays && args.autoRemindAfterDays > 0) {
      // Schedule reminder for each pending recipient
      for (const recipient of recipients) {
        // Only schedule for recipients who haven't completed their action
        if (
          recipient.status !== "signed" &&
          recipient.status !== "approved" &&
          recipient.status !== "declined"
        ) {
          const scheduledFor = now + args.autoRemindAfterDays * 24 * 60 * 60 * 1000;

          const reminderId = await ctx.db.insert("document_reminders", {
            documentId: args.documentId,
            recipientId: recipient._id,
            type: "automated",
            status: "scheduled",
            scheduledFor,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          });

          // Schedule the reminder processing
          const delayMs = scheduledFor - now;
          await ctx.scheduler.runAfter(delayMs, internal.documents?.reminders.processReminder, {
            reminderId,
          });
        }
      }
    }

    return {
      success: true,
      recipientCount: recipients.length,
      sharedWithCount,
      remindersScheduled: args.autoRemindAfterDays ? recipients.length : 0,
    };
  },
});

/**
 * Mark document as completed
 * Called when all recipients have taken their required actions
 * Requires documents:edit permission
 */
export const completeDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 3. Verify all recipients have completed their actions
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const allCompleted = recipients.every(
      (r) => r.status === "signed" || r.status === "approved" || r.status === "declined",
    );

    if (!allCompleted) {
      throw new ConvexError("Cannot complete document - not all recipients have taken action");
    }

    // 4. Mark document as completed
    await ctx.db.patch(args.documentId, {
      workflowStatus: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 5. Cancel any pending/scheduled reminders
    const pendingReminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_document_status", (q) =>
        q.eq("documentId", args.documentId).eq("status", "scheduled"),
      )
      .collect();

    const pendingReminders2 = await ctx.db
      .query("document_reminders")
      .withIndex("by_document_status", (q) =>
        q.eq("documentId", args.documentId).eq("status", "pending"),
      )
      .collect();

    const allPendingReminders = [...pendingReminders, ...pendingReminders2];

    for (const reminder of allPendingReminders) {
      await ctx.db.patch(reminder._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      organizationId: document.organizationId,
      eventType: "document.completed",
      data: {
        document_id: args.documentId,
        name: document.name,
        completed_at: new Date().toISOString(),
      },
    });

    return { success: true, remindersCancelled: allPendingReminders.length };
  },
});

/**
 * Cancel a document that's been sent
 * Prevents recipients from taking further action
 * Requires documents:edit permission
 */
export const cancelDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 3. Can't cancel already completed document
    if (document.workflowStatus === "completed") {
      throw new ConvexError("Cannot cancel a completed document");
    }

    // 4. Mark document as cancelled
    await ctx.db.patch(args.documentId, {
      workflowStatus: "cancelled",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 5. Cancel all pending/scheduled reminders
    const pendingReminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const activeReminders = pendingReminders.filter(
      (r) => r.status === "scheduled" || r.status === "pending",
    );

    for (const reminder of activeReminders) {
      await ctx.db.patch(reminder._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      organizationId: document.organizationId,
      eventType: "document.voided",
      data: {
        document_id: args.documentId,
        name: document.name,
        reason: args.reason,
        voided_at: new Date().toISOString(),
      },
    });

    return { success: true, remindersCancelled: activeReminders.length };
  },
});

/**
 * Check if document workflow is complete
 * Used to automatically transition document to completed state
 * Requires documents:edit permission
 */
export const checkAndCompleteWorkflow = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 3. Skip if already in a final or payment-pending state
    if (
      document.workflowStatus === "completed" ||
      document.workflowStatus === "cancelled" ||
      document.workflowStatus === "waiting_for_payment"
    ) {
      return { success: true, completed: false, reason: "already_final" };
    }

    // 4. Check if all recipients have completed
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    if (recipients.length === 0) {
      return { success: true, completed: false, reason: "no_recipients" };
    }

    const allCompleted = recipients.every(
      (r) => r.status === "signed" || r.status === "approved" || r.status === "declined",
    );

    if (!allCompleted) {
      return { success: true, completed: false, reason: "pending_recipients" };
    }

    // 5. Check for unpaid payment fields
    const paymentConfigs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const hasUnpaidPayments = paymentConfigs.some(
      (config) => config.paymentStatus !== "paid" && config.paymentStatus !== "cancelled",
    );

    if (hasUnpaidPayments) {
      // Route to waiting_for_payment instead of completed
      await ctx.db.patch(args.documentId, {
        workflowStatus: "waiting_for_payment",
        updatedAt: Date.now(),
      });

      // Cancel pending reminders even in waiting_for_payment
      const pendingRemindersWfp = await ctx.db
        .query("document_reminders")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .collect();

      const activeRemindersWfp = pendingRemindersWfp.filter(
        (r) => r.status === "scheduled" || r.status === "pending",
      );

      for (const reminder of activeRemindersWfp) {
        await ctx.db.patch(reminder._id, {
          status: "cancelled",
          cancelledAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      return {
        success: true,
        completed: false,
        reason: "waiting_for_payment",
        remindersCancelled: activeRemindersWfp.length,
      };
    }

    // 6. No payment fields (or all paid) — mark document as completed
    await ctx.db.patch(args.documentId, {
      workflowStatus: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 7. Cancel pending reminders
    const pendingReminders = await ctx.db
      .query("document_reminders")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const activeReminders = pendingReminders.filter(
      (r) => r.status === "scheduled" || r.status === "pending",
    );

    for (const reminder of activeReminders) {
      await ctx.db.patch(reminder._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      organizationId: document.organizationId,
      eventType: "document.completed",
      data: {
        document_id: args.documentId,
        name: document.name,
        completed_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      completed: true,
      remindersCancelled: activeReminders.length,
    };
  },
});

/**
 * Check if all payment fields for a document are paid,
 * and if the document is in waiting_for_payment, transition to completed.
 *
 * Called from invoice.paid webhook handler after a payment config is updated.
 */
export const checkPaymentCompletionAndFinalize = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return { completed: false, reason: "document_not_found" };

    // Only act on documents in waiting_for_payment
    if (document.workflowStatus !== "waiting_for_payment") {
      return { completed: false, reason: "not_waiting_for_payment" };
    }

    // Check all payment configs for this document
    const paymentConfigs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const allPaid = paymentConfigs.every(
      (config) => config.paymentStatus === "paid" || config.paymentStatus === "cancelled",
    );

    if (!allPaid) {
      return { completed: false, reason: "payments_pending" };
    }

    // All payments collected — complete the document
    await ctx.db.patch(args.documentId, {
      workflowStatus: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      organizationId: document.organizationId,
      eventType: "document.completed",
      data: {
        document_id: args.documentId,
        name: document.name,
        completed_at: new Date().toISOString(),
      },
    });

    return { completed: true };
  },
});
