/**
 * Document recipients queries for Seal
 */

import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { authQuery } from "../auth";
import { isRecipientComplete } from "../schemas/document_recipients";

/**
 * Get all recipients for a document
 * Only accessible by document owner or recipients themselves
 */
export const getDocumentRecipients = authQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 2. Verify access (owner or recipient)
		const isOwner = document.ownerId === userId;
		let isRecipient = false;

		if (!isOwner) {
			// Check if user is a recipient by email
			const user = await ctx.db.get(userId);
			if (user) {
				const recipient = await ctx.db
					.query("document_recipients")
					.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
					.filter((q) =>
						q.eq(q.field("email"), user.email?.toLowerCase() || ""),
					)
					.first();
				isRecipient = recipient !== null;
			}
		}

		if (!isOwner && !isRecipient) {
			throw new ConvexError("You don't have access to this document");
		}

		// 3. Get all recipients
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		// 4. Sort by order if specified, otherwise by creation time
		recipients.sort((a, b) => {
			if (a.order !== undefined && b.order !== undefined) {
				return a.order - b.order;
			}
			if (a.order !== undefined) return -1;
			if (b.order !== undefined) return 1;
			return a.createdAt - b.createdAt;
		});

		// 5. Sanitize sensitive data if not owner
		if (!isOwner) {
			return recipients.map((r) => ({
				_id: r._id,
				documentId: r.documentId,
				email: r.email,
				name: r.name,
				role: r.role,
				status: r.status,
				order: r.order,
				// Hide token and sensitive timestamps from non-owners
				viewedAt: r.viewedAt,
				signedAt: r.signedAt,
				approvedAt: r.approvedAt,
				declinedAt: r.declinedAt,
				createdAt: r.createdAt,
			}));
		}

		return recipients;
	},
});

/**
 * Get a recipient by signing token (unauthenticated access)
 * This allows recipients to access the signing page via their unique link
 */
export const getRecipientByToken = query({
	args: {
		signingToken: v.string(),
	},
	handler: async (ctx, args) => {
		// 1. Find recipient by token
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

		// 3. Get the document (without access control since they have the token)
		const document = await ctx.db.get(recipient.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 4. Return sanitized recipient and document info
		return {
			recipient: {
				_id: recipient._id,
				documentId: recipient.documentId,
				email: recipient.email,
				name: recipient.name,
				role: recipient.role,
				status: recipient.status,
				viewedAt: recipient.viewedAt,
				signedAt: recipient.signedAt,
				approvedAt: recipient.approvedAt,
				declinedAt: recipient.declinedAt,
			},
			document: {
				_id: document._id,
				name: document.name,
				description: document.description,
				fileType: document.fileType,
				storageId: document.storageId,
			},
		};
	},
});

/**
 * Calculate recipient progress for a document
 * Shows completion percentage and breakdown by status
 */
export const getRecipientProgress = authQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 2. Verify ownership
		if (document.ownerId !== userId) {
			throw new ConvexError("Only the document owner can view progress");
		}

		// 3. Get all recipients
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		if (recipients.length === 0) {
			return {
				total: 0,
				completed: 0,
				percentComplete: 0,
				byStatus: {
					pending: 0,
					viewed: 0,
					signed: 0,
					approved: 0,
					declined: 0,
				},
				byRole: {
					signer: { total: 0, completed: 0 },
					viewer: { total: 0, completed: 0 },
					approver: { total: 0, completed: 0 },
				},
			};
		}

		// 4. Calculate statistics
		const total = recipients.length;
		let completed = 0;
		const byStatus = {
			pending: 0,
			viewed: 0,
			signed: 0,
			approved: 0,
			declined: 0,
		};
		const byRole = {
			signer: { total: 0, completed: 0 },
			viewer: { total: 0, completed: 0 },
			approver: { total: 0, completed: 0 },
		};

		for (const recipient of recipients) {
			// Count by status
			byStatus[recipient.status]++;

			// Count by role
			byRole[recipient.role].total++;

			// Check if completed
			if (isRecipientComplete(recipient.role, recipient.status)) {
				completed++;
				byRole[recipient.role].completed++;
			}
		}

		const percentComplete = Math.round((completed / total) * 100);

		return {
			total,
			completed,
			percentComplete,
			byStatus,
			byRole,
		};
	},
});

/**
 * Get all documents where the current user is a recipient
 */
export const getMyRecipientDocuments = authQuery({
	args: {},
	handler: async (ctx) => {
		const userId = ctx.auth.user._id;

		// 1. Get user email
		const user = await ctx.db.get(userId);
		if (!user || !user.email) {
			return [];
		}

		// 2. Get all recipients with user's email
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_email", (q) =>
				q.eq("email", user.email.toLowerCase()),
			)
			.collect();

		// 3. Get documents for each recipient
		const documentsMap = new Map();
		for (const recipient of recipients) {
			if (!documentsMap.has(recipient.documentId)) {
				const document = await ctx.db.get(recipient.documentId);
				if (document && document.status !== "deleted") {
					documentsMap.set(recipient.documentId, {
						document,
						recipient,
					});
				}
			}
		}

		// 4. Return array of documents with recipient info
		return Array.from(documentsMap.values()).sort(
			(a, b) => b.document.createdAt - a.document.createdAt,
		);
	},
});
