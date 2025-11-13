import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { AuditAction, AuditResourceType } from "../schemas/audit_logs";

/**
 * Audit Log Helper Functions
 *
 * Provides utilities for logging actions to the audit trail.
 * All functions are immutable - audit logs cannot be modified or deleted.
 *
 * SEA-31: Database Schemas - Audit Trail Implementation
 */

interface AuditLogParams {
	organizationId: Id<"organizations">;
	userId?: string; // Clerk user ID
	actorType: "user" | "recipient" | "system";
	actorId?: string;
	action: AuditAction;
	resourceType: AuditResourceType;
	resourceId?: string;
	documentId?: Id<"documents">;
	recipientId?: Id<"recipients">;
	oldValues?: Record<string, unknown>;
	newValues?: Record<string, unknown>;
	metadata?: {
		description?: string;
		source?: string;
		sessionId?: string;
	};
	ipAddress: string;
	userAgent?: string;
}

/**
 * Log an action to the audit trail
 * This is the main function for creating audit logs
 */
export async function logAction(
	ctx: MutationCtx,
	params: AuditLogParams,
): Promise<Id<"audit_logs">> {
	const auditLogId = await ctx.db.insert("audit_logs", {
		organizationId: params.organizationId,
		userId: params.userId,
		actorType: params.actorType,
		actorId: params.actorId,
		action: params.action,
		resourceType: params.resourceType,
		resourceId: params.resourceId,
		documentId: params.documentId,
		recipientId: params.recipientId,
		oldValues: params.oldValues,
		newValues: params.newValues,
		metadata: params.metadata,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		createdAt: Date.now(),
	});

	return auditLogId;
}

/**
 * Log a signature field action (create, update, delete)
 */
export async function logFieldAction(
	ctx: MutationCtx,
	params: {
		organizationId: Id<"organizations">;
		userId: string;
		action: "field.created" | "field.updated" | "field.deleted";
		fieldId: Id<"signature_fields">;
		documentId: Id<"documents">;
		recipientId: Id<"recipients">;
		oldValues?: Partial<Doc<"signature_fields">>;
		newValues?: Partial<Doc<"signature_fields">>;
		ipAddress: string;
		userAgent?: string;
	},
): Promise<Id<"audit_logs">> {
	return logAction(ctx, {
		organizationId: params.organizationId,
		userId: params.userId,
		actorType: "user",
		actorId: params.userId,
		action: params.action,
		resourceType: "signature_field",
		resourceId: params.fieldId,
		documentId: params.documentId,
		recipientId: params.recipientId,
		oldValues: params.oldValues as Record<string, unknown>,
		newValues: params.newValues as Record<string, unknown>,
		metadata: {
			description: `Field ${params.action.split(".")[1]} for document`,
			source: "web",
		},
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
	});
}

/**
 * Log a signature action (create, update)
 */
export async function logSignatureAction(
	ctx: MutationCtx,
	params: {
		organizationId: Id<"organizations">;
		recipientId: Id<"recipients">;
		action: "signature.created" | "signature.updated";
		signatureId: Id<"signatures">;
		fieldId: Id<"signature_fields">;
		documentId: Id<"documents">;
		oldValues?: Partial<Doc<"signatures">>;
		newValues?: Partial<Doc<"signatures">>;
		ipAddress: string;
		userAgent?: string;
	},
): Promise<Id<"audit_logs">> {
	return logAction(ctx, {
		organizationId: params.organizationId,
		actorType: "recipient",
		actorId: params.recipientId,
		action: params.action,
		resourceType: "signature",
		resourceId: params.signatureId,
		documentId: params.documentId,
		recipientId: params.recipientId,
		oldValues: params.oldValues as Record<string, unknown>,
		newValues: params.newValues as Record<string, unknown>,
		metadata: {
			description: `Signature ${params.action.split(".")[1]}`,
			source: "web",
		},
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
	});
}

/**
 * Log a document action (created, updated, sent, completed, etc.)
 */
export async function logDocumentAction(
	ctx: MutationCtx,
	params: {
		organizationId: Id<"organizations">;
		userId: string;
		action: AuditAction;
		documentId: Id<"documents">;
		oldValues?: Partial<Doc<"documents">>;
		newValues?: Partial<Doc<"documents">>;
		description?: string;
		ipAddress: string;
		userAgent?: string;
	},
): Promise<Id<"audit_logs">> {
	return logAction(ctx, {
		organizationId: params.organizationId,
		userId: params.userId,
		actorType: "user",
		actorId: params.userId,
		action: params.action,
		resourceType: "document",
		resourceId: params.documentId,
		documentId: params.documentId,
		oldValues: params.oldValues as Record<string, unknown>,
		newValues: params.newValues as Record<string, unknown>,
		metadata: {
			description: params.description,
			source: "web",
		},
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
	});
}

/**
 * Get audit trail for a document
 * Returns all audit logs related to a document, ordered by creation time (newest first)
 */
export async function getDocumentAuditTrail(
	ctx: QueryCtx,
	documentId: Id<"documents">,
): Promise<Doc<"audit_logs">[]> {
	const auditLogs = await ctx.db
		.query("audit_logs")
		.withIndex("by_document_created", (q) => q.eq("documentId", documentId))
		.order("desc")
		.collect();

	return auditLogs;
}

/**
 * Get audit trail for an organization
 * Returns all audit logs for an organization, with optional pagination
 */
export async function getOrganizationAuditTrail(
	ctx: QueryCtx,
	organizationId: Id<"organizations">,
	limit = 100,
): Promise<Doc<"audit_logs">[]> {
	const auditLogs = await ctx.db
		.query("audit_logs")
		.withIndex("by_organization_created", (q) =>
			q.eq("organizationId", organizationId),
		)
		.order("desc")
		.take(limit);

	return auditLogs;
}

/**
 * Get audit trail for a specific recipient
 * Returns all actions performed by a recipient
 */
export async function getRecipientAuditTrail(
	ctx: QueryCtx,
	recipientId: Id<"recipients">,
): Promise<Doc<"audit_logs">[]> {
	const auditLogs = await ctx.db
		.query("audit_logs")
		.withIndex("by_recipient", (q) => q.eq("recipientId", recipientId))
		.order("desc")
		.collect();

	return auditLogs;
}
