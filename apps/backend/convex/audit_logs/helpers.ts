import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { AuditAction, AuditResourceType } from "../schemas/audit_logs";

/**
 * Accepts both raw MutationCtx and custom-wrapped mutation contexts.
 *
 * convex-helpers' customCtx/Overwrite produces a ctx type that replaces
 * ctx.auth (dropping getUserIdentity), making it incompatible with raw
 * MutationCtx. Since audit helpers only use ctx.db, we narrow the
 * requirement to just the db property.
 */
type AuditMutationCtx = Pick<MutationCtx, "db">;

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
  recipientId?: Id<"document_recipients">;
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
  ctx: AuditMutationCtx,
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

const MAX_AUDIT_RETRIES = 3;

/**
 * Log an action to the audit trail with retry and failure handling.
 *
 * ESIGN Act compliance requirement: audit logging must succeed or the
 * action that triggered it must be blocked. This function retries up to
 * 3 times and throws a ConvexError if all attempts fail, which will
 * roll back the entire mutation transaction.
 *
 * Note: In Convex, mutations are atomic — if ctx.db.insert throws, the
 * mutation is retried via OCC. This wrapper provides an additional
 * safety net for unexpected errors (e.g., validation failures) and
 * ensures the calling code is aware that audit logging is mandatory.
 */
export async function logActionRequired(
  ctx: AuditMutationCtx,
  params: AuditLogParams,
): Promise<Id<"audit_logs">> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_AUDIT_RETRIES; attempt++) {
    try {
      return await logAction(ctx, params);
    } catch (error) {
      lastError = error;
      console.error(
        `[Audit] Failed attempt ${attempt}/${MAX_AUDIT_RETRIES} for ${params.action}:`,
        error,
      );
    }
  }

  // All retries exhausted — block the action
  throw new ConvexError({
    code: "AUDIT_LOG_FAILURE",
    message: `Audit logging failed after ${MAX_AUDIT_RETRIES} attempts. Action blocked for compliance.`,
    action: params.action,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
}

/**
 * Log a signature field action (create, update, delete)
 */
export async function logFieldAction(
  ctx: AuditMutationCtx,
  params: {
    organizationId: Id<"organizations">;
    userId: string;
    action: "field.created" | "field.updated" | "field.deleted";
    fieldId: Id<"signature_fields">;
    documentId: Id<"documents">;
    recipientId?: Id<"document_recipients">;
    oldValues?: Partial<Doc<"signature_fields">>;
    newValues?: Partial<Doc<"signature_fields">>;
    ipAddress: string;
    userAgent?: string;
  },
): Promise<Id<"audit_logs">> {
  return logActionRequired(ctx, {
    organizationId: params.organizationId,
    userId: params.userId,
    actorType: "user",
    actorId: params.userId,
    action: params.action,
    resourceType: "signature_field",
    resourceId: params.fieldId,
    documentId: params.documentId,
    recipientId: params.recipientId,
    oldValues: params.oldValues,
    newValues: params.newValues,
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
  ctx: AuditMutationCtx,
  params: {
    organizationId: Id<"organizations">;
    recipientId: Id<"document_recipients">;
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
  return logActionRequired(ctx, {
    organizationId: params.organizationId,
    actorType: "recipient",
    actorId: params.recipientId,
    action: params.action,
    resourceType: "signature",
    resourceId: params.signatureId,
    documentId: params.documentId,
    recipientId: params.recipientId,
    oldValues: params.oldValues,
    newValues: params.newValues,
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
  ctx: AuditMutationCtx,
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
  return logActionRequired(ctx, {
    organizationId: params.organizationId,
    userId: params.userId,
    actorType: "user",
    actorId: params.userId,
    action: params.action,
    resourceType: "document",
    resourceId: params.documentId,
    documentId: params.documentId,
    oldValues: params.oldValues,
    newValues: params.newValues,
    metadata: {
      description: params.description,
      source: "web",
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a recipient action (viewed, signed, declined)
 * Supports both token-based (actorType: "recipient") and authenticated (actorType: "user") flows
 */
export async function logRecipientAction(
  ctx: AuditMutationCtx,
  params: {
    organizationId: Id<"organizations">;
    actorType: "user" | "recipient";
    actorId: string;
    userId?: string;
    action: "recipient.added" | "recipient.updated" | "recipient.removed" | "recipient.viewed" | "recipient.signed" | "recipient.declined" | "recipient.esign_consent" | "recipient.esign_opt_out";
    documentId: Id<"documents">;
    recipientId: Id<"document_recipients">;
    newValues?: Record<string, unknown>;
    ipAddress: string;
    userAgent?: string;
  },
): Promise<Id<"audit_logs">> {
  return logActionRequired(ctx, {
    organizationId: params.organizationId,
    userId: params.userId,
    actorType: params.actorType,
    actorId: params.actorId,
    action: params.action,
    resourceType: "recipient",
    resourceId: params.recipientId,
    documentId: params.documentId,
    recipientId: params.recipientId,
    newValues: params.newValues,
    metadata: {
      description: `Recipient ${params.action.split(".")[1]}`,
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
    .withIndex("by_organization_created", (q) => q.eq("organizationId", organizationId))
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
  recipientId: Id<"document_recipients">,
): Promise<Doc<"audit_logs">[]> {
  const auditLogs = await ctx.db
    .query("audit_logs")
    .withIndex("by_recipient", (q) => q.eq("recipientId", recipientId))
    .order("desc")
    .collect();

  return auditLogs;
}
