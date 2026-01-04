/**
 * Document Shared Email Action
 *
 * Handles sending emails when a document is shared with a user.
 * This is an action (not a mutation) because it calls external email service.
 */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { sendDocumentShared } from "./email";

/**
 * Send document shared notification email
 *
 * This action is called after a document is shared with a user.
 * It sends a notification email to the recipient informing them
 * about the shared document and their access level.
 */
export const sendDocumentSharedEmail = internalAction({
	args: {
		documentId: v.id("documents"),
		recipientUserId: v.id("users"),
		sharedByUserId: v.id("users"),
		permissionLevel: v.union(
			v.literal("view"),
			v.literal("edit"),
			v.literal("manage"),
		),
		notificationId: v.optional(v.id("notifications")),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		error?: string;
	}> => {
		// 1. Get the document
		const document = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{ documentId: args.documentId },
		);

		if (!document) {
			return {
				success: false,
				error: "Document not found",
			};
		}

		// 2. Get the recipient user
		const recipientUser = await ctx.runQuery(
			internal.organizations.helpers.getUserById,
			{ userId: args.recipientUserId },
		);

		if (!recipientUser?.email) {
			return {
				success: false,
				error: "Recipient user not found or has no email",
			};
		}

		// 3. Get the sharer user
		const sharerUser = await ctx.runQuery(
			internal.organizations.helpers.getUserById,
			{ userId: args.sharedByUserId },
		);

		if (!sharerUser?.email) {
			return {
				success: false,
				error: "Sharer user not found or has no email",
			};
		}

		// 4. Build document URL
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
		const documentUrl = `${baseUrl}/documents/${document._id}`;

		// 5. Send the email
		const result = await sendDocumentShared({
			to: recipientUser.email,
			recipientName: recipientUser.name || recipientUser.email,
			sharerName: sharerUser.name || sharerUser.email,
			sharerEmail: sharerUser.email,
			documentName: document.name,
			permissionLevel: args.permissionLevel,
			documentUrl,
		});

		if (!result.success) {
			console.error("Failed to send document shared email:", result.error);

			if (args.notificationId) {
				await ctx.runMutation(internal.notifications.index.updateEmailStatus, {
					notificationId: args.notificationId,
					status: "failed",
					error: result.error,
				});
			}

			return {
				success: false,
				error: result.error,
			};
		}

		if (args.notificationId) {
			await ctx.runMutation(internal.notifications.index.updateEmailStatus, {
				notificationId: args.notificationId,
				status: "sent",
			});
		}

		return { success: true };
	},
});
