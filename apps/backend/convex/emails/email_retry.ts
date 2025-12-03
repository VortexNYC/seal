/**
 * Email Retry System
 *
 * Handles retrying failed email sends with exponential backoff
 */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { sendWelcome } from "../documents/email";

/**
 * Process pending email retries
 * This should be called periodically via a cron job
 */
export const processEmailRetries = internalAction({
	args: {},
	handler: async (
		ctx,
	): Promise<{
		processed: number;
		succeeded: number;
		failed: number;
	}> => {
		// Get emails that need retry
		const emailsToRetry: Doc<"email_logs">[] = await ctx.runQuery(
			internal.emails.email_logs.getEmailsForRetry,
			{},
		);

		let processed = 0;
		let succeeded = 0;
		let failed = 0;

		for (const emailLog of emailsToRetry) {
			processed++;

			// Mark as being retried (prevent duplicate processing)
			await ctx.runMutation(internal.emails.email_retry.markEmailRetrying, {
				emailLogId: emailLog._id,
			});

			try {
				let result: { success: boolean; messageId?: string; error?: string };

				// Retry based on email type
				switch (emailLog.type) {
					case "document_invitation":
						// We need additional context for document invitation
						// For now, mark as failed - would need to store original params
						result = {
							success: false,
							error:
								"Document invitation retry not implemented - missing original params",
						};
						break;

					case "document_reminder":
						// Would need original params
						result = {
							success: false,
							error: "Reminder retry not implemented - missing original params",
						};
						break;

					case "welcome":
						result = await sendWelcome({
							to: emailLog.toEmail,
							userName: emailLog.toName || "there",
						});
						break;

					case "team_invitation":
						// Would need original params (inviter info, org name, etc.)
						result = {
							success: false,
							error:
								"Team invitation retry not implemented - missing original params",
						};
						break;

					default:
						result = {
							success: false,
							error: `Unknown email type: ${emailLog.type}`,
						};
				}

				if (result.success) {
					succeeded++;
					await ctx.runMutation(internal.emails.email_logs.updateEmailStatus, {
						emailLogId: emailLog._id,
						status: "sent",
						messageId: result.messageId,
					});
				} else {
					failed++;
					await ctx.runMutation(internal.emails.email_logs.updateEmailStatus, {
						emailLogId: emailLog._id,
						status: "failed",
						error: result.error,
					});
				}
			} catch (error) {
				failed++;
				await ctx.runMutation(internal.emails.email_logs.updateEmailStatus, {
					emailLogId: emailLog._id,
					status: "failed",
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		return { processed, succeeded, failed };
	},
});

/**
 * Mark email as being retried (to prevent duplicate processing)
 */
export const markEmailRetrying = internalMutation({
	args: {
		emailLogId: v.id("email_logs"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.emailLogId, {
			// Clear nextRetryAt to prevent duplicate processing
			nextRetryAt: undefined,
			updatedAt: Date.now(),
		});
	},
});

/**
 * Manually retry a specific failed email
 */
export const retryEmail = internalAction({
	args: {
		emailLogId: v.id("email_logs"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		error?: string;
	}> => {
		const emailLog: Doc<"email_logs"> | null = await ctx.runQuery(
			internal.emails.email_logs.getEmailLogById,
			{ emailLogId: args.emailLogId },
		);

		if (!emailLog) {
			return { success: false, error: "Email log not found" };
		}

		if (emailLog.status !== "failed") {
			return { success: false, error: "Email is not in failed status" };
		}

		if (emailLog.attemptCount >= emailLog.maxRetries) {
			return { success: false, error: "Maximum retry attempts exceeded" };
		}

		// Schedule the retry
		await ctx.runMutation(internal.emails.email_retry.scheduleRetry, {
			emailLogId: args.emailLogId,
		});

		return { success: true };
	},
});

/**
 * Schedule immediate retry for an email
 */
export const scheduleRetry = internalMutation({
	args: {
		emailLogId: v.id("email_logs"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.emailLogId, {
			nextRetryAt: Date.now(), // Immediate retry
			updatedAt: Date.now(),
		});
	},
});
