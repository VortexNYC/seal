/**
 * Audit Log Queries
 *
 * Provides queries for retrieving and exporting audit trail data.
 * Required for legal compliance (ESIGN Act, UETA) and security auditing.
 *
 * SEA-108: Digital Signature Implementation - Audit Trail Export
 */

import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { authQuery } from "../auth";
import { generateSignatureCertificate } from "../crypto/helpers";

/**
 * Get audit trail for a document (authenticated)
 * Returns all audit logs for a specific document
 */
export const getDocumentAuditLogs = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check access - only owner or org members with workspace access
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

		// 3. Get audit trail (inlined to avoid type issues)
		const auditLogs = await ctx.db
			.query("audit_logs")
			.withIndex("by_document_created", (q) =>
				q.eq("documentId", args.documentId),
			)
			.order("desc")
			.collect();

		return auditLogs;
	},
});

/**
 * Get organization audit logs (authenticated)
 * Returns audit logs for the entire organization with pagination
 */
export const getOrganizationAuditLogs = authQuery({
	args: {
		organizationId: v.id("organizations"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Verify user is an admin of the organization
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", userId).eq("organizationId", args.organizationId),
			)
			.first();

		if (!member || member.status !== "active") {
			throw new ConvexError("You are not a member of this organization");
		}

		// Get role to check if admin (roleId may be undefined for some members)
		if (member.roleId) {
			const role = await ctx.db.get(member.roleId);
			if (!role || role.name !== "admin") {
				throw new ConvexError("Only admins can view organization audit logs");
			}
		} else {
			throw new ConvexError("Only admins can view organization audit logs");
		}

		// 2. Get audit trail (inlined to avoid type issues)
		const limit = args.limit ?? 100;
		const auditLogs = await ctx.db
			.query("audit_logs")
			.withIndex("by_organization_created", (q) =>
				q.eq("organizationId", args.organizationId),
			)
			.order("desc")
			.take(limit);

		return auditLogs;
	},
});

/**
 * Export complete audit trail for a document (compliance export)
 * Returns a comprehensive export including:
 * - Document metadata
 * - All signatures with cryptographic certificates
 * - Complete audit trail
 * - Integrity verification status
 *
 * SEA-108: Compliance-ready audit trail export
 */
export const exportDocumentAuditTrail = authQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Only owner can export audit trail
		if (document.ownerId !== userId) {
			throw new ConvexError("Only the document owner can export audit trail");
		}

		// 3. Get all related data
		const [signatures, recipients, fields, auditLogs] = await Promise.all([
			ctx.db
				.query("signatures")
				.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
				.collect(),
			ctx.db
				.query("document_recipients")
				.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
				.collect(),
			ctx.db
				.query("signature_fields")
				.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
				.collect(),
			ctx.db
				.query("audit_logs")
				.withIndex("by_document_created", (q) =>
					q.eq("documentId", args.documentId),
				)
				.order("desc")
				.collect(),
		]);

		// 4. Generate signature certificates
		const signatureCertificates = signatures.map((signature) => {
			const recipient = recipients.find((r) => r._id === signature.recipientId);
			return generateSignatureCertificate(
				{
					signatureHash: signature.signatureHash,
					documentHashAtSigning: signature.documentHashAtSigning,
					signedAt: signature.signedAt,
					ipAddress: signature.ipAddress,
					userAgent: signature.userAgent,
					signatureMethod: signature.signatureMethod,
				},
				{
					name: recipient?.name,
					email: recipient?.email ?? "unknown",
				},
				{
					name: document.name,
					documentHash: document.documentHash,
				},
			);
		});

		// 5. Build export object
		const exportData = {
			exportVersion: "1.0",
			exportedAt: new Date().toISOString(),
			exportedBy: userId,

			document: {
				id: document._id,
				name: document.name,
				description: document.description,
				fileType: document.fileType,
				fileSize: document.fileSize,
				pageCount: document.pageCount,
				createdAt: new Date(document.createdAt).toISOString(),
				updatedAt: new Date(document.updatedAt).toISOString(),
				workflowStatus: document.workflowStatus,
				documentHash: document.documentHash,
				integrityStatus: document.documentHash
					? "hash_available"
					: "no_hash_computed",
			},

			recipients: recipients.map((r) => ({
				id: r._id,
				name: r.name,
				email: r.email,
				role: r.role,
				status: r.status,
				signedAt: r.signedAt ? new Date(r.signedAt).toISOString() : null,
				viewedAt: r.viewedAt ? new Date(r.viewedAt).toISOString() : null,
				declinedAt: r.declinedAt ? new Date(r.declinedAt).toISOString() : null,
			})),

			fields: fields.map((f) => ({
				id: f._id,
				fieldType: f.fieldType,
				isRequired: f.isRequired,
				page: f.page,
				recipientId: f.recipientId,
				signed: signatures.some((s) => s.fieldId === f._id),
			})),

			signatures: signatures.map((s) => ({
				id: s._id,
				fieldId: s.fieldId,
				recipientId: s.recipientId,
				signedAt: new Date(s.signedAt).toISOString(),
				signatureMethod: s.signatureMethod,
				signatureHash: s.signatureHash,
				documentHashAtSigning: s.documentHashAtSigning,
				ipAddress: s.ipAddress,
				userAgent: s.userAgent,
			})),

			signatureCertificates,

			auditTrail: auditLogs.map((log) => ({
				id: log._id,
				action: log.action,
				actorType: log.actorType,
				actorId: log.actorId,
				resourceType: log.resourceType,
				resourceId: log.resourceId,
				timestamp: new Date(log.createdAt).toISOString(),
				ipAddress: log.ipAddress,
				userAgent: log.userAgent,
				metadata: log.metadata,
			})),

			summary: {
				totalRecipients: recipients.length,
				signedRecipients: recipients.filter((r) => r.status === "signed")
					.length,
				totalFields: fields.length,
				requiredFields: fields.filter((f) => f.isRequired).length,
				completedFields: signatures.length,
				auditLogEntries: auditLogs.length,
				completionPercentage:
					fields.length > 0
						? Math.round((signatures.length / fields.length) * 100)
						: 0,
			},
		};

		return exportData;
	},
});

/**
 * Get audit trail for a signing session (public, token-based)
 * Used on the signing page to show activity to the signer
 */
export const getSigningSessionAuditTrail = query({
	args: { signingToken: v.string() },
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

		// 3. Get audit logs for this recipient only (for privacy)
		const recipientLogs = await ctx.db
			.query("audit_logs")
			.withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
			.order("desc")
			.collect();

		// 4. Filter to only show relevant actions to the signer
		const allowedActions = [
			"recipient.viewed",
			"signature.created",
			"signature.updated",
			"recipient.signed",
		];

		const filteredLogs = recipientLogs.filter((log) =>
			allowedActions.includes(log.action),
		);

		return {
			logs: filteredLogs.map((log) => ({
				action: log.action,
				timestamp: new Date(log.createdAt).toISOString(),
				description: log.metadata?.description,
			})),
			recipientStatus: recipient.status,
		};
	},
});
