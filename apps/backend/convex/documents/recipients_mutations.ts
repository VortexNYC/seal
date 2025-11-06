/**
 * Document recipients mutations for Seal
 */

import { ConvexError, v } from "convex/values";
import { authMutation } from "../auth";
import {
	recipientRoleTuple,
	recipientStatusTuple,
} from "../schemas/document_recipients";
import { verifyDocumentOwnership } from "./recipient_helpers";

/**
 * Generate a unique signing token
 */
function generateSigningToken(): string {
	// Generate a cryptographically secure random token
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Add recipients to a document
 * Can only be called on draft documents by the owner
 */
export const addRecipients = authMutation({
	args: {
		documentId: v.id("documents"),
		recipients: v.array(
			v.object({
				email: v.string(),
				name: v.optional(v.string()),
				role: recipientRoleTuple,
				order: v.optional(v.number()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Verify ownership
		await verifyDocumentOwnership(ctx, args.documentId, userId);

		// 2. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 3. Verify document is in draft status
		if (document.status === "deleted") {
			throw new ConvexError("Cannot add recipients to deleted document");
		}

		// 4. Validate recipients
		if (args.recipients.length === 0) {
			throw new ConvexError("At least one recipient is required");
		}

		// Check for duplicate emails
		const emails = args.recipients.map((r) => r.email.toLowerCase());
		const uniqueEmails = new Set(emails);
		if (emails.length !== uniqueEmails.size) {
			throw new ConvexError("Duplicate recipient emails are not allowed");
		}

		// 5. Create recipient records
		const recipientIds = [];
		const now = Date.now();
		const tokenExpiration = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

		for (const recipient of args.recipients) {
			const recipientId = await ctx.db.insert("document_recipients", {
				documentId: args.documentId,
				email: recipient.email.toLowerCase(),
				name: recipient.name,
				role: recipient.role,
				status: "pending",
				order: recipient.order,
				signingToken: generateSigningToken(),
				tokenExpiresAt: tokenExpiration,
				createdAt: now,
				updatedAt: now,
			});
			recipientIds.push(recipientId);
		}

		return { recipientIds, count: recipientIds.length };
	},
});

/**
 * Remove a recipient from a document
 * Can only be called on draft documents by the owner
 */
export const removeRecipient = authMutation({
	args: {
		recipientId: v.id("document_recipients"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the recipient
		const recipient = await ctx.db.get(args.recipientId);
		if (!recipient) {
			throw new ConvexError("Recipient not found");
		}

		// 2. Verify ownership of the document
		await verifyDocumentOwnership(ctx, recipient.documentId, userId);

		// 3. Get the document
		const document = await ctx.db.get(recipient.documentId);
		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 4. Verify document is in draft status
		if (document.status === "deleted") {
			throw new ConvexError("Cannot remove recipients from deleted document");
		}

		// 5. Delete the recipient
		await ctx.db.delete(args.recipientId);

		return { success: true };
	},
});

/**
 * Update recipient status (internal use - called by recipient actions)
 * This mutation can be called by anyone with a valid signing token
 */
export const updateRecipientStatus = authMutation({
	args: {
		signingToken: v.string(),
		status: recipientStatusTuple,
		signatureData: v.optional(v.string()),
		signatureType: v.optional(
			v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded")),
		),
		declineReason: v.optional(v.string()),
		ipAddress: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// 1. Find recipient by signing token
		const recipient = await ctx.db
			.query("document_recipients")
			.withIndex("by_token", (q) => q.eq("signingToken", args.signingToken))
			.first();

		if (!recipient) {
			throw new ConvexError("Invalid signing token");
		}

		// 2. Check token expiration
		if (recipient.tokenExpiresAt < Date.now()) {
			throw new ConvexError("Signing token has expired");
		}

		// 3. Validate status transition
		// Cannot change status if already in terminal state
		if (
			recipient.status === "signed" ||
			recipient.status === "approved" ||
			recipient.status === "declined"
		) {
			throw new ConvexError(
				`Cannot update status - recipient has already ${recipient.status}`,
			);
		}

		// 4. Validate status change is appropriate for role
		if (args.status === "signed" && recipient.role !== "signer") {
			throw new ConvexError("Only signers can have status 'signed'");
		}
		if (args.status === "approved" && recipient.role !== "approver") {
			throw new ConvexError("Only approvers can have status 'approved'");
		}

		// 5. Validate required data
		if (args.status === "signed") {
			if (!args.signatureData || !args.signatureType) {
				throw new ConvexError(
					"Signature data and type are required for signing",
				);
			}
		}
		if (args.status === "declined" && !args.declineReason) {
			throw new ConvexError("Decline reason is required");
		}

		// 6. Update the recipient
		const now = Date.now();
		const updateData: Record<string, unknown> = {
			status: args.status,
			updatedAt: now,
		};

		// Set appropriate timestamp
		switch (args.status) {
			case "viewed":
				if (!recipient.viewedAt) {
					updateData.viewedAt = now;
				}
				break;
			case "signed":
				updateData.signedAt = now;
				updateData.signatureData = args.signatureData;
				updateData.signatureType = args.signatureType;
				if (!recipient.viewedAt) {
					updateData.viewedAt = now;
				}
				break;
			case "approved":
				updateData.approvedAt = now;
				if (!recipient.viewedAt) {
					updateData.viewedAt = now;
				}
				break;
			case "declined":
				updateData.declinedAt = now;
				updateData.declineReason = args.declineReason;
				if (!recipient.viewedAt) {
					updateData.viewedAt = now;
				}
				break;
		}

		if (args.ipAddress) {
			updateData.ipAddress = args.ipAddress;
		}

		await ctx.db.patch(recipient._id, updateData);

		return { success: true, recipientId: recipient._id };
	},
});

/**
 * Regenerate signing token for a recipient (if expired or compromised)
 * Can only be called by document owner
 */
export const regenerateSigningToken = authMutation({
	args: {
		recipientId: v.id("document_recipients"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the recipient
		const recipient = await ctx.db.get(args.recipientId);
		if (!recipient) {
			throw new ConvexError("Recipient not found");
		}

		// 2. Verify ownership
		await verifyDocumentOwnership(ctx, recipient.documentId, userId);

		// 3. Check recipient status - cannot regenerate for completed recipients
		if (
			recipient.status === "signed" ||
			recipient.status === "approved" ||
			recipient.status === "declined"
		) {
			throw new ConvexError(
				"Cannot regenerate token for recipients who have already completed their action",
			);
		}

		// 4. Generate new token with extended expiration
		const now = Date.now();
		const newToken = generateSigningToken();
		const newExpiration = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

		await ctx.db.patch(args.recipientId, {
			signingToken: newToken,
			tokenExpiresAt: newExpiration,
			updatedAt: now,
		});

		return { success: true, newToken };
	},
});
