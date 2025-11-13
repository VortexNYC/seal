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

/**
 * SEA-32: Composite Queries for Testing Related Data
 * These queries retrieve documents with all their related data
 */

/**
 * Get document with all its signatures
 * SEA-32: Composite query to retrieve document and related signatures
 */
export const getDocumentWithSignatures = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document with access control
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check access
		let hasAccess = document.ownerId === userId;
		if (!hasAccess) {
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();

			if (member && member.status === "active") {
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

		// 3. Get all signatures for this document
		const signatures = await ctx.db
			.query("signatures")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		// 4. Get all signature fields for this document
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		// 5. Enrich signatures with field and recipient information
		const enrichedSignatures = await Promise.all(
			signatures.map(async (signature) => {
				const field = await ctx.db.get(signature.fieldId);
				const recipient = await ctx.db.get(signature.recipientId);

				return {
					...signature,
					field,
					recipient,
				};
			}),
		);

		return {
			document,
			signatures: enrichedSignatures,
			fields,
			signatureCount: signatures.length,
			fieldCount: fields.length,
		};
	},
});

/**
 * Get document with its complete audit trail
 * SEA-32: Composite query to retrieve document and audit history
 */
export const getDocumentWithAuditTrail = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document with access control
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check access
		let hasAccess = document.ownerId === userId;
		if (!hasAccess) {
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();

			if (member && member.status === "active") {
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

		// 3. Get audit trail for this document
		const auditLogs = await ctx.db
			.query("audit_logs")
			.withIndex("by_document_created", (q) =>
				q.eq("documentId", args.documentId),
			)
			.order("desc")
			.collect();

		return {
			document,
			auditLogs,
			auditLogCount: auditLogs.length,
		};
	},
});

/**
 * Get complete document data with all relationships
 * SEA-32: Comprehensive query for full document context
 * Useful for document detail pages that need all related data
 */
export const getDocumentComplete = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document with access control
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check access
		let hasAccess = document.ownerId === userId;
		if (!hasAccess) {
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();

			if (member && member.status === "active") {
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

		// 3. Get all related data in parallel for performance
		const [signatures, fields, recipients, auditLogs] = await Promise.all([
			ctx.db
				.query("signatures")
				.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
				.collect(),
			ctx.db
				.query("signature_fields")
				.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
				.collect(),
			ctx.db
				.query("recipients")
				.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
				.collect(),
			ctx.db
				.query("audit_logs")
				.withIndex("by_document_created", (q) =>
					q.eq("documentId", args.documentId),
				)
				.order("desc")
				.take(50), // Limit audit logs to most recent 50
		]);

		// 4. Enrich signatures with field and recipient information
		const enrichedSignatures = await Promise.all(
			signatures.map(async (signature) => {
				const field = await ctx.db.get(signature.fieldId);
				const recipient = await ctx.db.get(signature.recipientId);

				return {
					...signature,
					field,
					recipient,
				};
			}),
		);

		// 5. Calculate completion statistics
		const requiredFields = fields.filter((f) => f.isRequired);
		const completedFields = fields.filter((f) =>
			signatures.some((s) => s.fieldId === f._id),
		);

		return {
			document,
			signatures: enrichedSignatures,
			fields,
			recipients,
			auditLogs,
			statistics: {
				totalFields: fields.length,
				requiredFields: requiredFields.length,
				completedFields: completedFields.length,
				signatureCount: signatures.length,
				recipientCount: recipients.length,
				auditLogCount: auditLogs.length,
				completionPercentage:
					fields.length > 0
						? Math.round((completedFields.length / fields.length) * 100)
						: 0,
			},
		};
	},
});
