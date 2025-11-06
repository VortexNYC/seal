/**
 * Document reminder mutations and internal functions
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { authMutation } from "../auth";
import { verifyDocumentOwnership } from "./recipient_helpers";

/**
 * Send manual reminder to specific recipient
 * Triggered by document owner
 */
export const sendManualReminder = authMutation({
	args: {
		documentId: v.id("documents"),
		recipientId: v.id("document_recipients"),
		customMessage: v.optional(v.string()),
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

		// 3. Get the recipient
		const recipient = await ctx.db.get(args.recipientId);
		if (!recipient || recipient.documentId !== args.documentId) {
			throw new ConvexError(
				"Recipient not found or doesn't belong to document",
			);
		}

		// 4. Check recipient status - don't remind completed recipients
		if (
			recipient.status === "signed" ||
			recipient.status === "approved" ||
			recipient.status === "declined"
		) {
			throw new ConvexError(
				`Cannot send reminder - recipient has already ${recipient.status}`,
			);
		}

		// 5. Create reminder record
		const now = Date.now();
		const reminderId = await ctx.db.insert("document_reminders", {
			documentId: args.documentId,
			recipientId: args.recipientId,
			type: "manual",
			status: "pending",
			scheduledFor: now, // Send immediately
			customMessage: args.customMessage,
			createdBy: userId,
			createdAt: now,
			updatedAt: now,
		});

		// 6. Schedule immediate sending
		// When email is enabled, this will actually send the email
		await ctx.scheduler.runAfter(
			0,
			internal.documents.reminders.processReminder,
			{
				reminderId,
			},
		);

		return { reminderId, success: true };
	},
});

/**
 * Send manual reminder to all pending recipients
 * Triggered by document owner
 */
export const sendBulkReminder = authMutation({
	args: {
		documentId: v.id("documents"),
		customMessage: v.optional(v.string()),
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

		// 3. Get all pending recipients
		const allRecipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const pendingRecipients = allRecipients.filter(
			(r) =>
				r.status !== "signed" &&
				r.status !== "approved" &&
				r.status !== "declined",
		);

		if (pendingRecipients.length === 0) {
			throw new ConvexError("No pending recipients to remind");
		}

		// 4. Create reminder records for each pending recipient
		const now = Date.now();
		const reminderIds: string[] = [];

		for (const recipient of pendingRecipients) {
			const reminderId = await ctx.db.insert("document_reminders", {
				documentId: args.documentId,
				recipientId: recipient._id,
				type: "manual",
				status: "pending",
				scheduledFor: now,
				customMessage: args.customMessage,
				createdBy: userId,
				createdAt: now,
				updatedAt: now,
			});

			reminderIds.push(reminderId);

			// Schedule sending
			await ctx.scheduler.runAfter(
				0,
				internal.documents.reminders.processReminder,
				{
					reminderId,
				},
			);
		}

		return {
			reminderIds,
			count: reminderIds.length,
			success: true,
		};
	},
});

/**
 * Schedule automated reminder for a document
 * Called when document is sent or at intervals
 */
export const scheduleAutomatedReminder = authMutation({
	args: {
		documentId: v.id("documents"),
		daysUntilReminder: v.number(), // How many days from now to send
		recipientId: v.optional(v.id("document_recipients")), // Optional: specific recipient
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

		// 3. Calculate scheduled time
		const now = Date.now();
		const scheduledFor = now + args.daysUntilReminder * 24 * 60 * 60 * 1000;

		// 4. Create reminder record
		const reminderId = await ctx.db.insert("document_reminders", {
			documentId: args.documentId,
			recipientId: args.recipientId,
			type: "automated",
			status: "scheduled",
			scheduledFor,
			createdBy: userId,
			createdAt: now,
			updatedAt: now,
		});

		// 5. Schedule the reminder
		const delayMs = scheduledFor - now;
		await ctx.scheduler.runAfter(
			delayMs,
			internal.documents.reminders.processReminder,
			{
				reminderId,
			},
		);

		return { reminderId, scheduledFor, success: true };
	},
});

/**
 * Cancel a scheduled reminder
 */
export const cancelReminder = authMutation({
	args: {
		reminderId: v.id("document_reminders"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the reminder
		const reminder = await ctx.db.get(args.reminderId);
		if (!reminder) {
			throw new ConvexError("Reminder not found");
		}

		// 2. Verify ownership of the document
		await verifyDocumentOwnership(ctx, reminder.documentId, userId);

		// 3. Check if reminder can be cancelled
		if (reminder.status === "sent") {
			throw new ConvexError(
				"Cannot cancel reminder that has already been sent",
			);
		}

		if (reminder.status === "cancelled") {
			throw new ConvexError("Reminder is already cancelled");
		}

		// 4. Cancel the reminder
		await ctx.db.patch(args.reminderId, {
			status: "cancelled",
			cancelledAt: Date.now(),
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Internal: Process and send a reminder
 * Called by scheduler when it's time to send the reminder
 */
export const processReminder = internalMutation({
	args: {
		reminderId: v.id("document_reminders"),
	},
	handler: async (ctx, args) => {
		try {
			// 1. Get the reminder
			const reminder = await ctx.db.get(args.reminderId);
			if (!reminder) {
				console.error(`Reminder ${args.reminderId} not found`);
				return { success: false, error: "Reminder not found" };
			}

			// 2. Check if reminder was cancelled
			if (reminder.status === "cancelled") {
				console.log(`Reminder ${args.reminderId} was cancelled, skipping`);
				return { success: true, skipped: true };
			}

			// 3. Check if already sent
			if (reminder.status === "sent") {
				console.log(`Reminder ${args.reminderId} already sent, skipping`);
				return { success: true, skipped: true };
			}

			// 4. Get document and recipient info
			const document = await ctx.db.get(reminder.documentId);
			if (!document || document.status === "deleted") {
				await ctx.db.patch(args.reminderId, {
					status: "failed",
					failedAt: Date.now(),
					lastError: "Document not found or deleted",
					updatedAt: Date.now(),
				});
				return { success: false, error: "Document not found" };
			}

			let recipientInfo = null;
			if (reminder.recipientId) {
				const recipient = await ctx.db.get(reminder.recipientId);
				if (!recipient) {
					await ctx.db.patch(args.reminderId, {
						status: "failed",
						failedAt: Date.now(),
						lastError: "Recipient not found",
						updatedAt: Date.now(),
					});
					return { success: false, error: "Recipient not found" };
				}

				// Don't send if recipient has already completed action
				if (
					recipient.status === "signed" ||
					recipient.status === "approved" ||
					recipient.status === "declined"
				) {
					await ctx.db.patch(args.reminderId, {
						status: "cancelled",
						cancelledAt: Date.now(),
						updatedAt: Date.now(),
					});
					console.log(
						`Recipient ${recipient._id} already ${recipient.status}, cancelling reminder`,
					);
					return { success: true, skipped: true };
				}

				recipientInfo = {
					email: recipient.email,
					name: recipient.name,
					role: recipient.role,
					signingToken: recipient.signingToken,
				};
			}

			// 5. Mark as sent
			// TODO: When email is enabled, actually send the email here
			// For now, just mark as sent to track reminder history
			await ctx.db.patch(args.reminderId, {
				status: "sent",
				sentAt: Date.now(),
				updatedAt: Date.now(),
			});

			console.log(
				`Reminder ${args.reminderId} processed for document ${reminder.documentId}`,
				recipientInfo ? `to ${recipientInfo.email}` : "(bulk)",
			);

			// TODO: When email service is configured:
			// await sendReminderEmail({
			//   recipient: recipientInfo,
			//   document: document,
			//   customMessage: reminder.customMessage
			// });

			return { success: true, sent: true };
		} catch (error) {
			console.error(`Error processing reminder ${args.reminderId}:`, error);

			// Fetch reminder to get current attemptCount
			const reminderForUpdate = await ctx.db.get(args.reminderId);

			// Update reminder with error
			await ctx.db.patch(args.reminderId, {
				status: "failed",
				failedAt: Date.now(),
				lastError: error instanceof Error ? error.message : "Unknown error",
				attemptCount: (reminderForUpdate?.attemptCount || 0) + 1,
				updatedAt: Date.now(),
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
