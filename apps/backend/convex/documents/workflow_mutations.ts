/**
 * Document workflow mutations
 * Handles document lifecycle: sending to recipients, tracking progress, completion
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { permissionMutation } from "../auth";
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
			throw new ConvexError(
				"Document must have at least one recipient before sending",
			);
		}

		// 4. Update document status
		const now = Date.now();
		await ctx.db.patch(args.documentId, {
			status: "active",
			sentAt: now,
			updatedAt: now,
		});

		// 5. Schedule automated reminders if requested
		if (args.autoRemindAfterDays && args.autoRemindAfterDays > 0) {
			// Schedule reminder for each pending recipient
			for (const recipient of recipients) {
				// Only schedule for recipients who haven't completed their action
				if (
					recipient.status !== "signed" &&
					recipient.status !== "approved" &&
					recipient.status !== "declined"
				) {
					const scheduledFor =
						now + args.autoRemindAfterDays * 24 * 60 * 60 * 1000;

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
					await ctx.scheduler.runAfter(
						delayMs,
						internal.documents?.reminders.processReminder,
						{
							reminderId,
						},
					);
				}
			}
		}

		return {
			success: true,
			recipientCount: recipients.length,
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
			(r) =>
				r.status === "signed" ||
				r.status === "approved" ||
				r.status === "declined",
		);

		if (!allCompleted) {
			throw new ConvexError(
				"Cannot complete document - not all recipients have taken action",
			);
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

		// 3. Skip if already completed or cancelled
		if (
			document.workflowStatus === "completed" ||
			document.workflowStatus === "cancelled"
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
			(r) =>
				r.status === "signed" ||
				r.status === "approved" ||
				r.status === "declined",
		);

		if (!allCompleted) {
			return { success: true, completed: false, reason: "pending_recipients" };
		}

		// 5. All recipients completed - mark document as completed
		await ctx.db.patch(args.documentId, {
			workflowStatus: "completed",
			completedAt: Date.now(),
			updatedAt: Date.now(),
		});

		// 6. Cancel pending reminders
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

		return {
			success: true,
			completed: true,
			remindersCancelled: activeReminders.length,
		};
	},
});
