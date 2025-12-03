/**
 * Email Logs mutations and queries
 *
 * Handles logging and tracking email delivery status
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
	type EmailStatus,
	type EmailType,
	emailStatusTuple,
	emailTypeTuple,
} from "../schemas/email_logs";

/**
 * Create email log entry
 */
export const createEmailLog = internalMutation({
	args: {
		type: emailTypeTuple,
		toEmail: v.string(),
		toName: v.optional(v.string()),
		fromUserId: v.optional(v.id("users")),
		documentId: v.optional(v.id("documents")),
		recipientId: v.optional(v.id("document_recipients")),
		organizationId: v.optional(v.id("organizations")),
		reminderId: v.optional(v.id("document_reminders")),
		invitationId: v.optional(v.id("organization_invitations")),
		subject: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		const emailLogId = await ctx.db.insert("email_logs", {
			type: args.type,
			toEmail: args.toEmail,
			toName: args.toName,
			fromUserId: args.fromUserId,
			documentId: args.documentId,
			recipientId: args.recipientId,
			organizationId: args.organizationId,
			reminderId: args.reminderId,
			invitationId: args.invitationId,
			subject: args.subject,
			status: "queued",
			attemptCount: 0,
			maxRetries: 3,
			createdAt: now,
			updatedAt: now,
		});

		return { emailLogId };
	},
});

/**
 * Update email log status after sending
 */
export const updateEmailStatus = internalMutation({
	args: {
		emailLogId: v.id("email_logs"),
		status: emailStatusTuple,
		messageId: v.optional(v.string()),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const emailLog = await ctx.db.get(args.emailLogId);

		if (!emailLog) {
			console.error(`Email log ${args.emailLogId} not found`);
			return { success: false };
		}

		const updates: Partial<{
			status: EmailStatus;
			messageId: string;
			sentAt: number;
			deliveredAt: number;
			openedAt: number;
			clickedAt: number;
			bouncedAt: number;
			complainedAt: number;
			failedAt: number;
			lastError: string;
			attemptCount: number;
			nextRetryAt: number;
			updatedAt: number;
		}> = {
			status: args.status,
			updatedAt: now,
		};

		if (args.messageId) {
			updates.messageId = args.messageId;
		}

		// Set timestamp based on status
		switch (args.status) {
			case "sent":
				updates.sentAt = now;
				break;
			case "delivered":
				updates.deliveredAt = now;
				break;
			case "opened":
				updates.openedAt = now;
				break;
			case "clicked":
				updates.clickedAt = now;
				break;
			case "bounced":
				updates.bouncedAt = now;
				break;
			case "complained":
				updates.complainedAt = now;
				break;
			case "failed":
				updates.failedAt = now;
				updates.attemptCount = emailLog.attemptCount + 1;
				updates.lastError = args.error;

				// Schedule retry if not exceeded max retries
				if (emailLog.attemptCount + 1 < emailLog.maxRetries) {
					// Exponential backoff: 1min, 5min, 15min
					const backoffMinutes = [1, 5, 15];
					const delay = backoffMinutes[emailLog.attemptCount] || 15;
					updates.nextRetryAt = now + delay * 60 * 1000;
				}
				break;
		}

		await ctx.db.patch(args.emailLogId, updates);

		return { success: true };
	},
});

/**
 * Get email logs for a document
 */
export const getDocumentEmailLogs = internalQuery({
	args: {
		documentId: v.id("documents"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const query = ctx.db
			.query("email_logs")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.order("desc");

		if (args.limit) {
			return await query.take(args.limit);
		}

		return await query.collect();
	},
});

/**
 * Get email logs by status (for retry processing)
 */
export const getEmailsForRetry = internalQuery({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		return await ctx.db
			.query("email_logs")
			.withIndex("by_status_retry", (q) => q.eq("status", "failed"))
			.filter((q) =>
				q.and(
					q.neq(q.field("nextRetryAt"), undefined),
					q.lte(q.field("nextRetryAt"), now),
				),
			)
			.collect();
	},
});

/**
 * Get email log by ID
 */
export const getEmailLogById = internalQuery({
	args: {
		emailLogId: v.id("email_logs"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.emailLogId);
	},
});

/**
 * Get email statistics for an organization
 */
export const getOrganizationEmailStats = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const query = ctx.db
			.query("email_logs")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", args.organizationId),
			);

		const logs = await query.collect();

		// Filter by date if provided
		const filteredLogs = logs.filter((log) => {
			if (args.startDate && log.createdAt < args.startDate) return false;
			if (args.endDate && log.createdAt > args.endDate) return false;
			return true;
		});

		// Calculate stats
		const stats = {
			total: filteredLogs.length,
			sent: 0,
			delivered: 0,
			opened: 0,
			clicked: 0,
			bounced: 0,
			failed: 0,
			byType: {} as Record<EmailType, number>,
		};

		for (const log of filteredLogs) {
			switch (log.status) {
				case "sent":
				case "delivered":
				case "opened":
				case "clicked":
					stats.sent++;
					if (log.status === "delivered") stats.delivered++;
					if (log.status === "opened") stats.opened++;
					if (log.status === "clicked") stats.clicked++;
					break;
				case "bounced":
					stats.bounced++;
					break;
				case "failed":
					stats.failed++;
					break;
			}

			// Count by type
			stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
		}

		return stats;
	},
});
