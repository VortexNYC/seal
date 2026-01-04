/**
 * @fileoverview Documents REST API internal queries and handlers.
 * Provides CRUD operations for documents via the public API.
 *
 * @module api/v1/documents
 * @requires seal:documents:read scope for GET operations
 * @requires seal:documents:write scope for POST/PUT/DELETE operations
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import type { DocumentWorkflowStatus } from "../../schemas/document_workflow_status";

/**
 * API document response format.
 * Transforms internal document to external API format.
 */
export interface ApiDocument {
	/** Unique document identifier */
	id: string;
	/** Document title */
	title: string;
	/** Optional description */
	description?: string;
	/** Current workflow status */
	status:
		| "draft"
		| "sent"
		| "in_progress"
		| "completed"
		| "cancelled"
		| "declined";
	/** ISO 8601 creation timestamp */
	created_at: string;
	/** ISO 8601 last update timestamp */
	updated_at: string;
	/** Number of recipients */
	recipients_count: number;
	/** Number of recipients who have signed */
	signed_count: number;
	/** Optional signing deadline (ISO 8601) */
	deadline?: string;
}

/**
 * Internal query to list documents for API.
 * Implements access control based on organization membership.
 *
 * @internal
 */
export const listDocuments = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
		status: v.optional(v.string()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		documents: ApiDocument[];
		hasMore: boolean;
		nextCursor?: string;
	}> => {
		const limit = Math.min(args.limit ?? 20, 100);

		// Get documents for the organization
		const query = ctx.db
			.query("documents")
			.withIndex("by_organization_status", (q) =>
				q.eq("organizationId", args.organizationId).eq("status", "active"),
			);

		// Apply cursor-based pagination
		const documents = await query.order("desc").take(limit + 1);

		// Check if there are more results
		const hasMore = documents.length > limit;
		const resultDocs = hasMore ? documents.slice(0, limit) : documents;

		// Filter by workflow status if provided
		let filteredDocs = resultDocs;
		if (args.status) {
			filteredDocs = resultDocs.filter(
				(doc) => (doc.workflowStatus ?? "draft") === args.status,
			);
		}

		// Get recipient counts for each document
		const apiDocuments: ApiDocument[] = await Promise.all(
			filteredDocs.map(async (doc) => {
				const recipients = await ctx.db
					.query("document_recipients")
					.withIndex("by_document", (q) => q.eq("documentId", doc._id))
					.collect();

				const signedCount = recipients.filter(
					(r) => r.status === "signed" || r.status === "approved",
				).length;

				return {
					id: doc._id,
					title: doc.name,
					description: doc.description,
					status: (doc.workflowStatus ?? "draft") as ApiDocument["status"],
					created_at: new Date(doc.createdAt).toISOString(),
					updated_at: new Date(doc.updatedAt).toISOString(),
					recipients_count: recipients.length,
					signed_count: signedCount,
					deadline: doc.deadline
						? new Date(doc.deadline).toISOString()
						: undefined,
				};
			}),
		);

		// Generate next cursor if there are more results
		const lastDoc = resultDocs[resultDocs.length - 1];
		const nextCursor = hasMore && lastDoc ? lastDoc._id : undefined;

		return {
			documents: apiDocuments,
			hasMore,
			nextCursor,
		};
	},
});

/**
 * Internal query to get a single document for API.
 *
 * @internal
 */
export const getDocument = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		documentId: v.id("documents"),
		includeRecipients: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);

		if (!document || document.status === "deleted") {
			return null;
		}

		// Verify document belongs to the organization
		if (document.organizationId !== args.organizationId) {
			return null;
		}

		// Get recipients
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const signedCount = recipients.filter(
			(r) => r.status === "signed" || r.status === "approved",
		).length;

		const response: ApiDocument & {
			recipients?: Array<{
				id: string;
				email: string;
				name: string;
				role: string;
				status: string;
				signed_at?: string;
			}>;
			download_url?: string;
		} = {
			id: document._id,
			title: document.name,
			description: document.description,
			status: (document.workflowStatus ?? "draft") as ApiDocument["status"],
			created_at: new Date(document.createdAt).toISOString(),
			updated_at: new Date(document.updatedAt).toISOString(),
			recipients_count: recipients.length,
			signed_count: signedCount,
			deadline: document.deadline
				? new Date(document.deadline).toISOString()
				: undefined,
		};

		if (args.includeRecipients) {
			response.recipients = recipients.map((r) => ({
				id: r._id,
				email: r.email,
				name: r.name ?? "",
				role: r.role,
				status: r.status,
				signed_at: r.signedAt ? new Date(r.signedAt).toISOString() : undefined,
			}));
		}

		// Get download URL
		const downloadUrl = await ctx.storage.getUrl(document.storageId);
		if (downloadUrl) {
			response.download_url = downloadUrl;
		}

		return response;
	},
});

/**
 * Internal mutation to create a document via API.
 *
 * @internal
 */
export const createDocument = internalMutation({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		title: v.string(),
		description: v.optional(v.string()),
		storageId: v.string(),
		fileSize: v.number(),
		fileType: v.string(),
		pageCount: v.optional(v.number()),
		deadline: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<string> => {
		// Create the document
		const documentId = await ctx.db.insert("documents", {
			organizationId: args.organizationId,
			ownerId: args.userId,
			name: args.title,
			description: args.description,
			fileSize: args.fileSize,
			fileType: args.fileType,
			storageId: args.storageId,
			pageCount: args.pageCount,
			sharingMode: "private",
			status: "active",
			workflowStatus: "draft",
			deadline: args.deadline,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		return documentId;
	},
});

/**
 * Internal mutation to update a document via API.
 *
 * @internal
 */
export const updateDocument = internalMutation({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		documentId: v.id("documents"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		deadline: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const document = await ctx.db.get(args.documentId);

		if (!document || document.status === "deleted") {
			return { success: false, error: "Document not found" };
		}

		// Verify document belongs to the organization
		if (document.organizationId !== args.organizationId) {
			return { success: false, error: "Document not found" };
		}

		// Build update data
		const updateData: {
			name?: string;
			description?: string;
			deadline?: number;
			updatedAt: number;
		} = {
			updatedAt: Date.now(),
		};

		if (args.title !== undefined) {
			updateData.name = args.title;
		}
		if (args.description !== undefined) {
			updateData.description = args.description;
		}
		if (args.deadline !== undefined) {
			updateData.deadline = args.deadline;
		}

		await ctx.db.patch(args.documentId, updateData);

		return { success: true };
	},
});

/**
 * Internal mutation to delete a document via API.
 * Only draft documents can be deleted.
 *
 * @internal
 */
export const deleteDocument = internalMutation({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		documentId: v.id("documents"),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const document = await ctx.db.get(args.documentId);

		if (!document || document.status === "deleted") {
			return { success: false, error: "Document not found" };
		}

		// Verify document belongs to the organization
		if (document.organizationId !== args.organizationId) {
			return { success: false, error: "Document not found" };
		}

		// Only draft documents can be deleted
		const workflowStatus = document.workflowStatus ?? "draft";
		if (workflowStatus !== "draft") {
			return {
				success: false,
				error:
					"Only draft documents can be deleted. Use void to cancel sent documents.",
			};
		}

		// Soft delete
		await ctx.db.patch(args.documentId, {
			status: "deleted",
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Internal mutation to send a document for signing via API.
 *
 * @internal
 */
export const sendDocument = internalMutation({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		documentId: v.id("documents"),
		message: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const document = await ctx.db.get(args.documentId);

		if (!document || document.status === "deleted") {
			return { success: false, error: "Document not found" };
		}

		// Verify document belongs to the organization
		if (document.organizationId !== args.organizationId) {
			return { success: false, error: "Document not found" };
		}

		// Verify document is in draft status
		const currentStatus = document.workflowStatus ?? "draft";
		if (currentStatus !== "draft") {
			return {
				success: false,
				error: `Cannot send document with status: ${currentStatus}`,
			};
		}

		// Check that document has at least one recipient
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		if (recipients.length === 0) {
			return {
				success: false,
				error: "Document must have at least one recipient",
			};
		}

		// Update workflow status to sent
		await ctx.db.patch(args.documentId, {
			workflowStatus: "sent" as DocumentWorkflowStatus,
			sentAt: Date.now(),
			updatedAt: Date.now(),
		});

		// Update all recipients with sent timestamp
		for (const recipient of recipients) {
			await ctx.db.patch(recipient._id, {
				sentAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		// TODO: Trigger email sending via action

		return { success: true };
	},
});

/**
 * Internal mutation to void/cancel a document via API.
 *
 * @internal
 */
export const voidDocument = internalMutation({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		documentId: v.id("documents"),
		reason: v.string(),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const document = await ctx.db.get(args.documentId);

		if (!document || document.status === "deleted") {
			return { success: false, error: "Document not found" };
		}

		// Verify document belongs to the organization
		if (document.organizationId !== args.organizationId) {
			return { success: false, error: "Document not found" };
		}

		// Verify document can be voided (not completed or already cancelled)
		const currentStatus = document.workflowStatus ?? "draft";
		if (currentStatus === "completed") {
			return { success: false, error: "Cannot void a completed document" };
		}
		if (currentStatus === "cancelled") {
			return { success: false, error: "Document is already cancelled" };
		}

		// Update workflow status to cancelled
		await ctx.db.patch(args.documentId, {
			workflowStatus: "cancelled" as DocumentWorkflowStatus,
			cancelledAt: Date.now(),
			updatedAt: Date.now(),
		});

		// TODO: Notify recipients about cancellation

		return { success: true };
	},
});

/**
 * Internal query to get document download URL.
 *
 * @internal
 */
export const getDocumentDownloadUrl = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		documentId: v.id("documents"),
	},
	handler: async (ctx, args): Promise<{ url: string } | null> => {
		const document = await ctx.db.get(args.documentId);

		if (!document || document.status === "deleted") {
			return null;
		}

		// Verify document belongs to the organization
		if (document.organizationId !== args.organizationId) {
			return null;
		}

		// Use signed PDF if available, otherwise original
		const storageId = document.signedStorageId ?? document.storageId;
		const url = await ctx.storage.getUrl(storageId);

		if (!url) {
			return null;
		}

		return { url };
	},
});
