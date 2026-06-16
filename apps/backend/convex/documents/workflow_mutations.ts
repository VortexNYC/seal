/**
 * Document workflow mutations
 * Handles document lifecycle: sending to recipients, tracking progress, completion
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { permissionMutation } from "../auth";
import { resolveComponentMembershipForOrganization } from "../lib/componentOrgReads";
import { publishWebhookEvent } from "../webhooks/publish";
import { verifyDocumentOwnership } from "./recipient_helpers";

type WorkflowMutationDbCtx = Pick<MutationCtx, "db" | "runQuery">;
type WorkflowMutationSchedulerCtx = Pick<MutationCtx, "db" | "scheduler">;

function isRecipientFinished(status: Doc<"document_recipients">["status"]): boolean {
  return status === "signed" || status === "approved" || status === "declined";
}

async function getActiveReminders(
  ctx: WorkflowMutationDbCtx,
  documentId: Id<"documents">,
): Promise<Doc<"document_reminders">[]> {
  const reminders = await ctx.db
    .query("document_reminders")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  return reminders.filter(
    (reminder) => reminder.status === "scheduled" || reminder.status === "pending",
  );
}

async function cancelReminders(
  ctx: WorkflowMutationDbCtx,
  reminders: Doc<"document_reminders">[],
): Promise<void> {
  for (const reminder of reminders) {
    await ctx.db.patch(reminder._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

async function shareDocumentWithRecipientUsers(
  ctx: WorkflowMutationDbCtx,
  document: Doc<"documents">,
  recipients: Doc<"document_recipients">[],
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<number> {
  let sharedWithCount = 0;

  for (const recipient of recipients) {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", recipient.email))
      .first();

    if (!existingUser) {
      continue;
    }

    const organization = await ctx.db.get(document.organizationId);
    const orgMember = organization
      ? await resolveComponentMembershipForOrganization(ctx, existingUser, organization)
      : null;

    if (orgMember && orgMember.status === "active") {
      const existingAccess = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", documentId).eq("userId", existingUser._id),
        )
        .first();

      if (!existingAccess || existingAccess.revokedAt !== undefined) {
        if (existingAccess) {
          await ctx.db.patch(existingAccess._id, {
            permissionLevel: "view",
            grantedBy: userId,
            grantedAt: Date.now(),
            revokedAt: undefined,
          });
        } else {
          await ctx.db.insert("document_access", {
            documentId,
            userId: existingUser._id,
            permissionLevel: "view",
            grantedBy: userId,
            grantedAt: Date.now(),
          });
        }
        sharedWithCount++;
      }
    }

    if (!recipient.userId) {
      await ctx.db.patch(recipient._id, {
        userId: existingUser._id,
        updatedAt: Date.now(),
      });
    }
  }

  return sharedWithCount;
}

async function scheduleAutomaticReminders(
  ctx: WorkflowMutationSchedulerCtx,
  recipients: Doc<"document_recipients">[],
  documentId: Id<"documents">,
  userId: Id<"users">,
  now: number,
  autoRemindAfterDays?: number,
): Promise<void> {
  if (!autoRemindAfterDays || autoRemindAfterDays <= 0) {
    return;
  }

  for (const recipient of recipients) {
    if (isRecipientFinished(recipient.status)) {
      continue;
    }

    const scheduledFor = now + autoRemindAfterDays * 24 * 60 * 60 * 1000;
    const reminderId = await ctx.db.insert("document_reminders", {
      documentId,
      recipientId: recipient._id,
      type: "automated",
      status: "scheduled",
      scheduledFor,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(
      scheduledFor - now,
      internal.documents?.reminders.processReminder,
      {
        reminderId,
      },
    );
  }
}

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
    const sharedWithCount = await shareDocumentWithRecipientUsers(
      ctx,
      document,
      recipients,
      args.documentId,
      userId,
    );

    // 5. Update document status
    const now = Date.now();
    await ctx.db.patch(args.documentId, {
      status: "active",
      workflowStatus: "sent",
      sentAt: now,
      updatedAt: now,
    });

    // 6. Schedule automated reminders if requested
    await scheduleAutomaticReminders(
      ctx,
      recipients,
      args.documentId,
      userId,
      now,
      args.autoRemindAfterDays,
    );

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

    const allCompleted = recipients.every((recipient) => isRecipientFinished(recipient.status));

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
    const allPendingReminders = await getActiveReminders(ctx, args.documentId);
    await cancelReminders(ctx, allPendingReminders);

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
    const activeReminders = await getActiveReminders(ctx, args.documentId);
    await cancelReminders(ctx, activeReminders);

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

    const allCompleted = recipients.every((recipient) => isRecipientFinished(recipient.status));

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
      const activeRemindersWfp = await getActiveReminders(ctx, args.documentId);
      await cancelReminders(ctx, activeRemindersWfp);

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
    const activeReminders = await getActiveReminders(ctx, args.documentId);
    await cancelReminders(ctx, activeReminders);

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
