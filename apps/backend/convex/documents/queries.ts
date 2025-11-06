/**
 * Document queries for Seal - Document Sharing
 */

import { ConvexError, v } from "convex/values";
import { authQuery } from "../auth";
import { documentWorkflowStatusTuple } from "../schemas/document_workflow_status";

/**
 * Get a single document by ID with access control
 */
export const getDocument = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check if user has access
		// Owner always has access
		let hasAccess = document.ownerId === userId;

		if (!hasAccess) {
			// Check organization membership
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();

			if (member && member.status === "active") {
				// Check sharing mode
				if (document.sharingMode === "workspace") {
					hasAccess = true;
				} else if (document.sharingMode === "specific") {
					const access = await ctx.db
						.query("document_access")
						.withIndex("by_document_user", (q) =>
							q.eq("documentId", document._id).eq("userId", userId),
						)
						.first();
					hasAccess = access !== null && access.revokedAt === undefined;
				}
			}
		}

		if (!hasAccess) {
			throw new ConvexError("You don't have access to this document");
		}

		return document;
	},
});

/**
 * Get download URL for a document
 */
export const getDocumentUrl = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check if user has access
		// Owner always has access
		let hasAccess = document.ownerId === userId;

		if (!hasAccess) {
			// Check organization membership
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();

			if (member && member.status === "active") {
				// Check sharing mode
				if (document.sharingMode === "workspace") {
					hasAccess = true;
				} else if (document.sharingMode === "specific") {
					const access = await ctx.db
						.query("document_access")
						.withIndex("by_document_user", (q) =>
							q.eq("documentId", document._id).eq("userId", userId),
						)
						.first();
					hasAccess = access !== null && access.revokedAt === undefined;
				}
			}
		}

		if (!hasAccess) {
			throw new ConvexError("You don't have access to this document");
		}

		// 3. Generate download URL from storage
		const url = await ctx.storage.getUrl(document.storageId);
		if (!url) {
			throw new ConvexError("File not found in storage");
		}

		return url;
	},
});

/**
 * List all documents accessible to the user in an organization
 */
export const listDocuments = authQuery({
	args: {
		organizationId: v.id("organizations"),
		filter: v.optional(
			v.union(
				v.literal("all"), // All accessible documents
				v.literal("owned"), // Documents I own
				v.literal("shared"), // Documents shared with me
			),
		),
		workflowStatus: v.optional(documentWorkflowStatusTuple),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;
		const filter = args.filter || "all";

		// 1. Verify user is a member of the organization
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", userId).eq("organizationId", args.organizationId),
			)
			.first();

		if (!member) {
			throw new ConvexError("You are not a member of this organization");
		}

		// 2. Get documents based on filter
		const allOrgDocuments = await ctx.db
			.query("documents")
			.withIndex("by_organization_status", (q) =>
				q.eq("organizationId", args.organizationId).eq("status", "active"),
			)
			.collect();

		// 3. Filter documents based on access
		const accessibleDocuments = [];

		for (const doc of allOrgDocuments) {
			// Skip based on ownership filter
			if (filter === "owned" && doc.ownerId !== userId) {
				continue;
			}
			if (filter === "shared" && doc.ownerId === userId) {
				continue;
			}

			// Skip based on workflow status filter (default to draft for migration)
			const docWorkflowStatus = doc.workflowStatus ?? "draft";
			if (args.workflowStatus && docWorkflowStatus !== args.workflowStatus) {
				continue;
			}

			// Check access
			// Owner always has access
			let hasAccess = doc.ownerId === userId;

			if (!hasAccess) {
				// Check sharing mode (already verified member above)
				if (doc.sharingMode === "workspace") {
					hasAccess = true;
				} else if (doc.sharingMode === "specific") {
					const access = await ctx.db
						.query("document_access")
						.withIndex("by_document_user", (q) =>
							q.eq("documentId", doc._id).eq("userId", userId),
						)
						.first();
					hasAccess = access !== null && access.revokedAt === undefined;
				}
			}

			if (hasAccess) {
				accessibleDocuments.push(doc);
			}
		}

		return accessibleDocuments;
	},
});

/**
 * Get access list for a document (who has access and their permission levels)
 */
export const getDocumentAccessList = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Only owner or users with manage permission can view access list
		if (document.ownerId !== userId) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", args.documentId).eq("userId", userId),
				)
				.first();

			if (!access || access.permissionLevel !== "manage") {
				throw new ConvexError(
					"Only the document owner or managers can view access list",
				);
			}
		}

		// 3. Get all access records for this document
		const accessRecords = await ctx.db
			.query("document_access")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.filter((q) => q.eq(q.field("revokedAt"), undefined))
			.collect();

		// 4. Enrich with user information
		const enrichedAccess = await Promise.all(
			accessRecords.map(async (access) => {
				const user = await ctx.db.get(access.userId);
				return {
					...access,
					user: user
						? {
								_id: user._id,
								name: user.name,
								email: user.email,
							}
						: null,
				};
			}),
		);

		return {
			sharingMode: document.sharingMode,
			specificAccess: enrichedAccess,
		};
	},
});

/**
 * Get documents by workflow status for the current user
 * Useful for dashboards and workflow-specific views
 */
export const getDocumentsByWorkflowStatus = authQuery({
	args: {
		organizationId: v.id("organizations"),
		workflowStatus: documentWorkflowStatusTuple,
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Verify user is a member of the organization
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", userId).eq("organizationId", args.organizationId),
			)
			.first();

		if (!member) {
			throw new ConvexError("You are not a member of this organization");
		}

		// 2. Get documents with specific workflow status
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_organization_workflow", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("workflowStatus", args.workflowStatus),
			)
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();

		// 3. Filter to only accessible documents
		const accessibleDocuments = [];

		for (const doc of documents) {
			// Check access
			let hasAccess = doc.ownerId === userId;

			if (!hasAccess) {
				// Check sharing mode
				if (doc.sharingMode === "workspace") {
					hasAccess = true;
				} else if (doc.sharingMode === "specific") {
					const access = await ctx.db
						.query("document_access")
						.withIndex("by_document_user", (q) =>
							q.eq("documentId", doc._id).eq("userId", userId),
						)
						.first();
					hasAccess = access !== null && access.revokedAt === undefined;
				}
			}

			if (hasAccess) {
				accessibleDocuments.push(doc);
			}
		}

		return accessibleDocuments;
	},
});
