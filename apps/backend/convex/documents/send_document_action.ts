/**
 * Document sending action - sends emails to recipients
 * Actions can call external services like Resend
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalMutation } from "../_generated/server";
import { sendDocumentInvitation } from "./email";

async function authorizeDocumentOwner(
	ctx: ActionCtx,
	documentId: Id<"documents">,
): Promise<{ document: Doc<"documents">; userId: Id<"users"> }> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new ConvexError("Authentication required");
	}

	const user = await ctx.runQuery(
		internal.organizations.helpers.getUserByClerkId,
		{
			clerkId: identity.subject,
		},
	);

	if (!user) {
		throw new ConvexError("User not found");
	}

	const document = await ctx.runQuery(
		internal.documents.queries.getDocumentInternal,
		{
			documentId,
		},
	);

	if (!document) {
		throw new ConvexError("Document not found");
	}

	const membership = await ctx.runQuery(
		internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
		{
			userId: user._id,
			organizationId: document.organizationId,
		},
	);

	if (!membership) {
		throw new ConvexError("You don't have access to this document");
	}

	if (document.ownerId !== user._id) {
		throw new ConvexError("Only the document owner can perform this action");
	}

	return { document, userId: user._id };
}

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
		// 1. Authenticate and authorize
		const { document } = await authorizeDocumentOwner(ctx, args.documentId);

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

		// 3. Validate document has at least one signature field
		const signatureFields = await ctx.runQuery(
			internal.signature_fields.queries.getFieldsByDocumentInternal,
			{
				documentId: args.documentId,
			},
		);

		if (signatureFields.length === 0) {
			throw new ConvexError(
				"Cannot send document without signature fields. Please add at least one signature field before sending.",
			);
		}

		// 4. Get sender information from document owner
		// For now, we'll get it from the document query
		// TODO: Add user query or get from context
		const senderName = "Seal User";

		// 5. Send emails to all recipients
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

		// 6. Check if any emails failed
		const failedEmails = emailResults.filter((r) => !r.success);
		const allEmailsSucceeded = failedEmails.length === 0;

		// 7. Mark document as sent only when all emails succeed so edits remain possible on failures
		if (allEmailsSucceeded) {
			await ctx.runMutation(
				internal.documents.send_document_action.markDocumentAsSent,
				{
					documentId: args.documentId,
				},
			);
		}

		return {
			success: allEmailsSucceeded,
			totalRecipients: recipients.length,
			emailsSent: emailResults.filter((r) => r.success).length,
			emailsFailed: failedEmails.length,
			failures: failedEmails,
		};
	},
});

/**
 * Resend email to a specific recipient
 * This allows resending to recipients who haven't completed their action
 */
export const resendRecipientEmail = action({
	args: {
		documentId: v.id("documents"),
		recipientId: v.id("document_recipients"),
		customMessage: v.optional(v.string()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		error?: string;
	}> => {
		// 1. Authenticate and authorize
		const { document } = await authorizeDocumentOwner(ctx, args.documentId);

		// 2. Verify document has been sent (not in draft)
		const workflowStatus = document.workflowStatus ?? "draft";
		if (workflowStatus === "draft") {
			return {
				success: false,
				error: "Cannot resend email - document has not been sent yet",
			};
		}

		// 3. Get specific recipient
		const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
			internal.documents.recipients_queries.getDocumentRecipientsInternal,
			{
				documentId: args.documentId,
			},
		);

		const recipient = recipients.find((r) => r._id === args.recipientId);
		if (!recipient) {
			return { success: false, error: "Recipient not found" };
		}

		// 4. Verify recipient hasn't completed their action
		if (
			recipient.status === "signed" ||
			recipient.status === "approved" ||
			recipient.status === "declined"
		) {
			return {
				success: false,
				error: `Cannot resend - recipient has already ${recipient.status}`,
			};
		}

		// 5. Generate signing URL
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
		const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;

		// 6. Get sender information
		// TODO: Get actual sender name from user
		const senderName = "Seal User";

		// 7. Send email
		const emailResult = await sendDocumentInvitation({
			to: recipient.email,
			recipientName: recipient.name || recipient.email,
			documentName: document.name,
			senderName,
			signingUrl,
			customMessage: args.customMessage,
			expiresAt: recipient.tokenExpiresAt,
		});

		return {
			success: emailResult.success,
			error: emailResult.error,
		};
	},
});
