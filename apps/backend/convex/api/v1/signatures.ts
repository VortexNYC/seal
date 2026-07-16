/**
 * @fileoverview Signatures REST API internal queries and handlers.
 * Provides read-only access to signature verification and audit data.
 *
 * @module api/v1/signatures
 * @requires seal:signatures:read scope for all operations
 */

import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import { internalQuery } from "../../_generated/server";

/**
 * API signature response format.
 */
export interface ApiSignature {
  /** Unique signature identifier */
  id: string;
  /** Field this signature is for */
  field_id: string;
  /** Field type */
  field_type: string;
  /** Field label */
  field_label?: string;
  /** Recipient who signed */
  recipient: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  /** Signature value (for text/date fields) */
  value?: string;
  /** Signature method used */
  signature_method?: "draw" | "type" | "upload";
  /** ISO 8601 timestamp when signed */
  signed_at: string;
  /** IP address of signer */
  ip_address: string;
  /** User agent string */
  user_agent: string;
  /** Authentication method used */
  authentication_method?: string;
  /** Whether authentication was verified */
  authentication_verified?: boolean;
}

type ApiDocument = Doc<"documents">;
type SignatureDoc = Doc<"signatures">;
type RecipientDoc = Doc<"document_recipients">;
type FieldDoc = Doc<"signature_fields">;

function isAccessibleDocument(
  document: ApiDocument | null,
  organizationId: Id<"organizations">,
): document is ApiDocument {
  return Boolean(
    document && document.status !== "deleted" && document.organizationId === organizationId,
  );
}

function buildApiSignature(
  signature: SignatureDoc,
  recipient: RecipientDoc | null,
  field: FieldDoc | null,
): ApiSignature {
  return {
    id: signature._id,
    field_id: signature.fieldId,
    field_type: field?.fieldType ?? "unknown",
    field_label: field?.label,
    recipient: {
      id: signature.recipientId,
      email: recipient?.email ?? "",
      name: recipient?.name ?? "",
      role: recipient?.role ?? "signer",
    },
    value: signature.value,
    signature_method: signature.signatureMethod,
    signed_at: new Date(signature.signedAt).toISOString(),
    ip_address: signature.ipAddress,
    user_agent: signature.userAgent,
    authentication_method: signature.authenticationData?.method,
    authentication_verified: signature.authenticationData?.verified,
  };
}

/**
 * Document verification result format.
 */
export interface ApiVerificationResult {
  /** Document ID */
  document_id: string;
  /** Document title */
  document_title: string;
  /** Overall verification status */
  verified: boolean;
  /** Document integrity check */
  integrity_check: {
    passed: boolean;
    checked_at: string;
    document_hash?: string;
  };
  /** All signatures on the document */
  signatures: Array<{
    recipient_email: string;
    recipient_name: string;
    role: string;
    signed_at: string;
    ip_address: string;
    signature_hash?: string;
    verified: boolean;
  }>;
  /** Total recipient count */
  total_recipients: number;
  /** Signed recipient count */
  signed_recipients: number;
  /** Document status */
  status: string;
}

/**
 * Internal query to list signatures for a document.
 *
 * @internal
 */
export const listSignatures = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<ApiSignature[] | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }
    if (document.organizationId !== args.organizationId) {
      return null;
    }

    // Get all signatures for the document
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, bounded by document signature count bound=global
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Get recipients and fields for enrichment
    const recipientIds = [...new Set(signatures.map((s) => s.recipientId))];
    const fieldIds = [...new Set(signatures.map((s) => s.fieldId))];

    const recipients = await Promise.all(recipientIds.map((id) => ctx.db.get(id)));
    const fields = await Promise.all(fieldIds.map((id) => ctx.db.get(id)));

    const recipientMap = new Map(recipients.map((r) => [r?._id, r]));
    const fieldMap = new Map(fields.map((f) => [f?._id, f]));

    return signatures.map((sig) => {
      const recipient = recipientMap.get(sig.recipientId);
      const field = fieldMap.get(sig.fieldId);

      return {
        id: sig._id,
        field_id: sig.fieldId,
        field_type: field?.fieldType ?? "unknown",
        field_label: field?.label,
        recipient: {
          id: sig.recipientId,
          email: recipient?.email ?? "",
          name: recipient?.name ?? "",
          role: recipient?.role ?? "signer",
        },
        value: sig.value,
        signature_method: sig.signatureMethod,
        signed_at: new Date(sig.signedAt).toISOString(),
        ip_address: sig.ipAddress,
        user_agent: sig.userAgent,
        authentication_method: sig.authenticationData?.method,
        authentication_verified: sig.authenticationData?.verified,
      };
    });
  },
});

/**
 * Internal query to get a single signature.
 *
 * @internal
 */
export const getSignature = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    signatureId: v.id("signatures"),
  },
  handler: async (ctx, args): Promise<ApiSignature | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!isAccessibleDocument(document, args.organizationId)) {
      return null;
    }

    // Get signature
    const sig = await ctx.db.get(args.signatureId);
    if (!sig || sig.documentId !== args.documentId) {
      return null;
    }

    // Get recipient and field
    const recipient = await ctx.db.get(sig.recipientId);
    const field = await ctx.db.get(sig.fieldId);

    return buildApiSignature(sig, recipient, field);
  },
});

/**
 * Internal query to verify document integrity and signatures.
 *
 * @internal
 */
export const verifyDocument = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<ApiVerificationResult | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }
    if (document.organizationId !== args.organizationId) {
      return null;
    }

    // Get all recipients. Verification requires complete recipient coverage for compliance and exact signed/total counts.
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, bounded by document recipient count and does not truncate verification inputs bound=global
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Get all signatures. Verification requires every signature on the document; missing rows would change the result.
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, bounded by document signature count and does not truncate verification inputs bound=global
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Build signature data
    const signatureData = await Promise.all(
      recipients
        .filter((r) => r.status === "signed" || r.status === "approved")
        .map(async (recipient) => {
          const recipientSigs = signatures.filter((s) => s.recipientId === recipient._id);
          const mainSig = recipientSigs.find((s) => s.signatureHash);

          return {
            recipient_email: recipient.email,
            recipient_name: recipient.name ?? "",
            role: recipient.role,
            signed_at: new Date(
              recipient.signedAt ?? recipient.approvedAt ?? Date.now(),
            ).toISOString(),
            ip_address: mainSig?.ipAddress ?? "",
            signature_hash: mainSig?.signatureHash,
            // Verification passes if we have a signature hash
            verified: !!mainSig?.signatureHash,
          };
        }),
    );

    const signedCount = recipients.filter(
      (r) => r.status === "signed" || r.status === "approved",
    ).length;

    // Document is verified if it's completed and all signatures have hashes
    const allVerified = signatureData.every((s) => s.verified);
    const documentCompleted = document.workflowStatus === "completed";

    return {
      document_id: document._id,
      document_title: document.name,
      verified: documentCompleted && allVerified,
      integrity_check: {
        passed: allVerified,
        checked_at: new Date().toISOString(),
        document_hash: document.documentHash,
      },
      signatures: signatureData,
      total_recipients: recipients.length,
      signed_recipients: signedCount,
      status: document.workflowStatus ?? "draft",
    };
  },
});

/**
 * Internal query to get audit trail for a document.
 *
 * @internal
 */
export const getAuditTrail = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    document_id: string;
    events: Array<{
      id: string;
      action: string;
      actor_email?: string;
      actor_name?: string;
      timestamp: string;
      ip_address?: string;
      metadata?: Record<string, unknown>;
    }>;
  } | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }
    if (document.organizationId !== args.organizationId) {
      return null;
    }

    // Get audit log entries for this document
    const limit = Math.min(args.limit ?? 100, 500);

    const auditLogs = await ctx.db
      .query("audit_logs")
      .withIndex("by_document_created", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(limit);

    // Enrich with user information by looking up users by authSubject
    const events = await Promise.all(
      auditLogs.map(async (log) => {
        let actorEmail: string | undefined;
        let actorName: string | undefined;

        if (log.userId) {
          // userId is an auth subject (string), find user by authSubject
          const user = await ctx.db
            .query("users")
            .withIndex("by_auth_subject", (q) => q.eq("authSubject", log.userId as string))
            .first();
          if (user) {
            actorEmail = user.email;
            actorName = user.name;
          }
        }

        return {
          id: log._id,
          action: log.action,
          actor_email: actorEmail,
          actor_name: actorName,
          timestamp: new Date(log.createdAt).toISOString(),
          ip_address: log.ipAddress,
          metadata: log.metadata as Record<string, unknown> | undefined,
        };
      }),
    );

    return {
      document_id: document._id,
      events,
    };
  },
});
