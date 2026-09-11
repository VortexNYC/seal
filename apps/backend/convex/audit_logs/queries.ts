/**
 * Audit Log Queries
 *
 * Provides queries for retrieving and exporting audit trail data.
 * Required for legal compliance (ESIGN Act, UETA) and security auditing.
 *
 * SEA-108: Digital Signature Implementation - Audit Trail Export
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { adminQuery, authQuery } from "../auth";
import {
  ACCESS_ERRORS,
  checkDocumentAccess,
  getDocumentOrThrow,
} from "../auth/access_control";
import { generateSignatureCertificate } from "../crypto/helpers";
import { findRecipientByToken } from "../documents/recipient_helpers";
import { auditActionTuple } from "../schemas/audit_logs";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

type AuditExportDocument = Doc<"documents">;
type AuditExportRecipients = Doc<"document_recipients">[];
type AuditExportFields = Doc<"signature_fields">[];
type AuditExportSignatures = Doc<"signatures">[];
type AuditExportLogs = Doc<"audit_logs">[];
type AuditExportSignatureCertificate = ReturnType<
  typeof generateSignatureCertificate
>;

async function getAuditExportData(
  ctx: { db: QueryCtx["db"] },
  documentId: AuditExportDocument["_id"]
): Promise<{
  signatures: AuditExportSignatures;
  recipients: AuditExportRecipients;
  fields: AuditExportFields;
  auditLogs: AuditExportLogs;
}> {
  const signatures: AuditExportSignatures = [];
  for await (const signature of ctx.db
    .query("signatures")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))) {
    signatures.push(signature);
  }

  const recipients: AuditExportRecipients = [];
  for await (const recipient of ctx.db
    .query("document_recipients")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))) {
    recipients.push(recipient);
  }

  const fields: AuditExportFields = [];
  for await (const field of ctx.db
    .query("signature_fields")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))) {
    fields.push(field);
  }

  const auditLogs: AuditExportLogs = [];
  for await (const log of ctx.db
    .query("audit_logs")
    .withIndex("by_document_created", (q) => q.eq("documentId", documentId))
    .order("desc")) {
    auditLogs.push(log);
  }

  return { signatures, recipients, fields, auditLogs };
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function buildSignatureCertificates(
  document: AuditExportDocument,
  signatures: AuditExportSignatures,
  recipients: AuditExportRecipients
): AuditExportSignatureCertificate[] {
  const recipientsById = new Map(
    recipients.map((recipient) => [recipient._id, recipient])
  );

  return signatures.map((signature) => {
    const recipient = recipientsById.get(signature.recipientId);
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
      }
    );
  });
}

function buildAuditExport(
  userId: Doc<"users">["_id"],
  document: AuditExportDocument,
  recipients: AuditExportRecipients,
  fields: AuditExportFields,
  signatures: AuditExportSignatures,
  auditLogs: AuditExportLogs,
  signatureCertificates: AuditExportSignatureCertificate[]
) {
  return {
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
      createdAt: toIsoString(document.createdAt),
      updatedAt: toIsoString(document.updatedAt),
      workflowStatus: document.workflowStatus,
      documentHash: document.documentHash,
      integrityStatus: document.documentHash
        ? "hash_available"
        : "no_hash_computed",
    },
    recipients: recipients.map((recipient) => ({
      id: recipient._id,
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      status: recipient.status,
      signedAt: recipient.signedAt ? toIsoString(recipient.signedAt) : null,
      viewedAt: recipient.viewedAt ? toIsoString(recipient.viewedAt) : null,
      declinedAt: recipient.declinedAt
        ? toIsoString(recipient.declinedAt)
        : null,
    })),
    fields: fields.map((field) => ({
      id: field._id,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      page: field.page,
      recipientId: field.recipientId,
      signed: signatures.some((signature) => signature.fieldId === field._id),
    })),
    signatures: signatures.map((signature) => ({
      id: signature._id,
      fieldId: signature.fieldId,
      recipientId: signature.recipientId,
      signedAt: toIsoString(signature.signedAt),
      signatureMethod: signature.signatureMethod,
      signatureHash: signature.signatureHash,
      documentHashAtSigning: signature.documentHashAtSigning,
      ipAddress: signature.ipAddress,
      userAgent: signature.userAgent,
    })),
    signatureCertificates,
    auditTrail: auditLogs.map((log) => ({
      id: log._id,
      action: log.action,
      actorType: log.actorType,
      actorId: log.actorId,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      timestamp: toIsoString(log.createdAt),
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
    })),
    summary: {
      totalRecipients: recipients.length,
      signedRecipients: recipients.filter(
        (recipient) => recipient.status === "signed"
      ).length,
      totalFields: fields.length,
      requiredFields: fields.filter((field) => field.isRequired).length,
      completedFields: signatures.length,
      auditLogEntries: auditLogs.length,
      completionPercentage:
        fields.length > 0
          ? Math.round((signatures.length / fields.length) * 100)
          : 0,
    },
  };
}

/**
 * Get audit trail for a document (authenticated)
 * Returns all audit logs for a specific document
 */
export const getDocumentAuditLogs = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = ctx.auth.userId;

    // 1. Get the document
    const document = await getDocumentOrThrow(ctx, args.documentId);

    // 2. Check access using shared access control
    const accessResult = await checkDocumentAccess(ctx, userId, document);
    if (!accessResult.hasAccess) {
      throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
    }

    // 3. Get audit trail
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, audit trail must be complete for compliance bound=global
    const auditLogs = [];
    for await (const log of ctx.db
      .query("audit_logs")
      .withIndex("by_document_created", (q) =>
        q.eq("documentId", args.documentId)
      )
      .order("desc")) {
      auditLogs.push(log);
    }

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
    if (
      ctx.auth.organizationId !== args.organizationId ||
      ctx.auth.member.status !== "active"
    ) {
      throw new ConvexError("You are not a member of this organization");
    }

    if (!["owner", "admin"].includes(ctx.auth.member.role)) {
      throw new ConvexError("Only admins can view organization audit logs");
    }

    // 2. Get audit trail (inlined to avoid type issues)
    const limit = args.limit ?? 100;
    const auditLogs = await ctx.db
      .query("audit_logs")
      .withIndex("by_organization_created", (q) =>
        q.eq("organizationId", args.organizationId)
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
    const userId = ctx.auth.userId;

    // 1. Get the document
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 2. Only owner can export audit trail
    if (document.ownerId !== userId) {
      throw new ConvexError("Only the document owner can export audit trail");
    }

    const { signatures, recipients, fields, auditLogs } =
      await getAuditExportData(ctx, args.documentId);
    const signatureCertificates = buildSignatureCertificates(
      document,
      signatures,
      recipients
    );

    return buildAuditExport(
      userId,
      document,
      recipients,
      fields,
      signatures,
      auditLogs,
      signatureCertificates
    );
  },
});

/**
 * Get audit trail for a document (internal, no auth)
 * Used by certificate generation and other internal processes
 */
export const getDocumentAuditTrailInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const auditLogs = [];
    for await (const log of ctx.db
      // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, audit trail must be complete for compliance
      .query("audit_logs")
      .withIndex("by_document_created", (q) =>
        q.eq("documentId", args.documentId)
      )
      .order("desc")) {
      auditLogs.push(log);
    }
    return auditLogs;
  },
});

/**
 * Get audit trail for a signing session (public, token-based)
 * Used on the signing page to show activity to the signer
 */
export const getSigningSessionAuditTrail = query({
  args: { signingToken: v.string() },
  handler: async (ctx, args) => {
    // 1. Find recipient by signing token (hash-based lookup with plaintext fallback)
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    // 2. Check token expiration
    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }

    // 3. Get audit logs for this recipient only (for privacy)
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single recipientId before the public action allowlist filter; complete signing-session activity is required, so no caller receives fewer rows bound=global
    const recipientLogs = [];
    for await (const log of ctx.db
      .query("audit_logs")
      .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
      .order("desc")) {
      recipientLogs.push(log);
    }

    // 4. Filter to only show relevant actions to the signer
    const allowedActions = new Set([
      "recipient.viewed",
      "signature.created",
      "signature.updated",
      "recipient.signed",
    ]);

    const filteredLogs = recipientLogs.filter((log) =>
      allowedActions.has(log.action)
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

/**
 * List organization audit logs with filters
 * Admin/owner only. Used by the Audit Log settings page.
 */
export const listOrgAuditLogs = adminQuery({
  args: {
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    actions: v.optional(v.array(auditActionTuple)),
    actorUserId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.auth.organizationId;
    const fetchLimit = Math.min((args.limit ?? 100) * 5, 1000);

    const logs = await ctx.db
      .query("audit_logs")
      .withIndex("by_organization_created", (q) => {
        const base = q.eq("organizationId", orgId);
        if (args.dateFrom !== undefined && args.dateTo !== undefined) {
          return base
            .gte("createdAt", args.dateFrom)
            .lte("createdAt", args.dateTo);
        }
        if (args.dateFrom !== undefined)
          return base.gte("createdAt", args.dateFrom);
        if (args.dateTo !== undefined)
          return base.lte("createdAt", args.dateTo);
        return base;
      })
      .order("desc")
      .take(fetchLimit);

    let filtered = logs;
    if (args.actions && args.actions.length > 0) {
      filtered = filtered.filter((l) =>
        sealAssertPresent(args.actions).includes(l.action)
      );
    }
    if (args.actorUserId) {
      filtered = filtered.filter((l) => l.userId === args.actorUserId);
    }

    return filtered.slice(0, args.limit ?? 100);
  },
});
