/**
 * Document sending action - sends emails to recipients
 * Actions can call external services like Resend
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalMutation } from "../_generated/server";
import { sendDocumentInvitation } from "./email";

/**
 * Internal mutation to update document status to sent
 */
export const markDocumentAsSent = internalMutation({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// Update document status to active and workflow status to sent
		await ctx.db.patch(args.documentId, {
			status: "active",
			workflowStatus: "sent",
			sentAt: Date.now(),
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Send document to all recipients via email
 * This is an action (not mutation) because it calls external email service
 */
export const sendDocumentEmails = action({
	args: {
		documentId: v.id("documents"),
		customMessage: v.optional(v.string()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		totalRecipients: number;
		emailsSent: number;
		emailsFailed: number;
		failures: Array<{
			recipientId: Id<"document_recipients">;
			success: boolean;
			error?: string;
		}>;
	}> => {
		// 1. Get document details
		const document: Doc<"documents"> | null = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{
				documentId: args.documentId,
			},
		);

		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 2. Get all recipients
		const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
			internal.documents.recipients_queries.getDocumentRecipientsInternal,
			{
				documentId: args.documentId,
			},
		);

		if (recipients.length === 0) {
			throw new ConvexError("No recipients found");
		}

		// 3. Validate all fields are assigned to recipients
		// TODO: Add field assignment validation here

		// 4. Mark document as sent
		await ctx.runMutation(
			internal.documents.send_document_action.markDocumentAsSent,
			{
				documentId: args.documentId,
			},
		);

		// 5. Get sender information from document owner
		// For now, we'll get it from the document query
		// TODO: Add user query or get from context
		const senderName = "Seal User";

		// 6. Send emails to all recipients
		const emailResults: Array<{
			recipientId: Id<"document_recipients">;
			success: boolean;
			error?: string;
		}> = [];

		for (const recipient of recipients) {
			// Only send to recipients who haven't completed their action
			if (
				recipient.status === "signed" ||
				recipient.status === "approved" ||
				recipient.status === "declined"
			) {
				continue;
			}

			// Generate signing URL
			const baseUrl =
				process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
			const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;

			// Send email
			const emailResult = await sendDocumentInvitation({
				to: recipient.email,
				recipientName: recipient.name || recipient.email,
				documentName: document.name,
				senderName,
				signingUrl,
				customMessage: args.customMessage,
				expiresAt: recipient.tokenExpiresAt,
			});

			emailResults.push({
				recipientId: recipient._id,
				success: emailResult.success,
				error: emailResult.error,
			});
		}

		// 7. Check if any emails failed
		const failedEmails = emailResults.filter((r) => !r.success);

		return {
			success: failedEmails.length === 0,
			totalRecipients: recipients.length,
			emailsSent: emailResults.filter((r) => r.success).length,
			emailsFailed: failedEmails.length,
			failures: failedEmails,
		};
	},
});
