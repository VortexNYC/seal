/**
 * Document queries for Seal - Document Sharing
 */

import { ConvexError, v } from "convex/values";

import { internalQuery, query } from "../_generated/server";
import { authQuery } from "../auth";
import {
  checkDocumentAccess,
  getDocumentWithAccessCheck,
  requireActiveMembership,
} from "../auth/access_control";
import { documentWorkflowStatusTuple } from "../schemas/document_workflow_status";
import { findRecipientByToken } from "./recipient_helpers";

/**
 * Get storage URL by storage ID
 * Used for thumbnail generation - minimal access check since document list already verified access
 */
export const getStorageUrl = authQuery({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    return url;
  },
});

/**
 * Get a single document by ID with access control
 */
export const getDocument = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;
    const { document } = await getDocumentWithAccessCheck(
      ctx,
      userId,
      args.documentId
    );
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
    const { document } = await getDocumentWithAccessCheck(
      ctx,
      userId,
      args.documentId
    );

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
      v.union(v.literal("all"), v.literal("owned"), v.literal("shared"))
    ),
    workflowStatus: v.optional(documentWorkflowStatusTuple),
    folderId: v.optional(v.id("folders")),
    rootOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;
    const filter = args.filter || "all";

    await requireActiveMembership(ctx, userId, args.organizationId);

    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — listDocuments must inspect the complete active organization document set so access checks and owned/shared/folder filters do not hide eligible rows; no caller receives fewer rows. bound=per-tenant
    const allOrgDocuments = await ctx.db
      .query("documents")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active")
      )
      .collect();

    const accessibleDocuments = [];

    for (const doc of allOrgDocuments) {
      if (filter === "owned" && doc.ownerId !== userId) {
        continue;
      }
      if (filter === "shared" && doc.ownerId === userId) {
        continue;
      }

      const docWorkflowStatus = doc.workflowStatus ?? "draft";
      if (args.workflowStatus && docWorkflowStatus !== args.workflowStatus) {
        continue;
      }

      const accessResult = await checkDocumentAccess(ctx, userId, doc);
      if (accessResult.hasAccess) {
        accessibleDocuments.push(doc);
      }
    }

    // Filter by folder
    const folderFiltered =
      args.folderId !== undefined
        ? accessibleDocuments.filter((doc) => doc.folderId === args.folderId)
        : args.rootOnly
          ? accessibleDocuments.filter((doc) => doc.folderId === undefined)
          : accessibleDocuments;

    return folderFiltered;
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
          q.eq("documentId", args.documentId).eq("userId", userId)
        )
        .first();

      if (!access || access.permissionLevel !== "manage") {
        throw new ConvexError(
          "Only the document owner or managers can view access list"
        );
      }
    }

    // 3. Get all access records for this document
    // convex-cost-guard-allow: convex-query-filter-before-collect — getDocumentAccessList must return every non-revoked access row for this document; the by_document equality range bounds the scan and no caller receives fewer rows. bound=global
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — same read: scoped to a single documentId, bounded by that document's access-grant count. bound=global
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
      })
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

    await requireActiveMembership(ctx, userId, args.organizationId);

    // convex-cost-guard-allow: convex-query-filter-before-collect — getDocumentsByWorkflowStatus must preserve all active documents for the requested organization/workflow; the organizationId plus workflowStatus index range bounds the read and no caller receives fewer rows. bound=per-tenant
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — same read: the (organizationId, workflowStatus) partition is the required complete set for workflow views. bound=per-tenant
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization_workflow", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("workflowStatus", args.workflowStatus)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const accessibleDocuments = [];

    for (const doc of documents) {
      const accessResult = await checkDocumentAccess(ctx, userId, doc);
      if (accessResult.hasAccess) {
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
    const { document } = await getDocumentWithAccessCheck(
      ctx,
      userId,
      args.documentId
    );

    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — getDocumentWithSignatures must return every signature for this single documentId for exact signature counts; no caller receives fewer rows. bound=global
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — getDocumentWithSignatures must return every signature field for this single documentId for exact field counts; no caller receives fewer rows. bound=global
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const enrichedSignatures = await Promise.all(
      signatures.map(async (signature) => {
        const field = await ctx.db.get(signature.fieldId);
        const recipient = await ctx.db.get(signature.recipientId);

        return {
          ...signature,
          field,
          recipient,
        };
      })
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
    const { document } = await getDocumentWithAccessCheck(
      ctx,
      userId,
      args.documentId
    );

    const auditLogs = await ctx.db
      // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, audit trail must be complete for compliance
      .query("audit_logs")
      .withIndex("by_document_created", (q) =>
        q.eq("documentId", args.documentId)
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
    const { document } = await getDocumentWithAccessCheck(
      ctx,
      userId,
      args.documentId
    );

    // Get all related data in parallel for performance
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — getDocumentComplete must return all signatures, fields, and recipients for this single documentId for exact document-detail statistics; no caller receives fewer rows. bound=global
    const [signatures, fields, recipients, auditLogs] = await Promise.all([
      ctx.db
        .query("signatures")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .collect(),
      ctx.db
        .query("signature_fields")
        // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — getDocumentComplete needs every signature field for this single documentId; bounded by document field count.
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .collect(),
      ctx.db
        .query("recipients")
        // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — getDocumentComplete needs every recipient for this single documentId; bounded by document recipient count.
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .collect(),
      ctx.db
        .query("audit_logs")
        .withIndex("by_document_created", (q) =>
          q.eq("documentId", args.documentId)
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
      })
    );

    // 5. Calculate completion statistics
    const requiredFields = fields.filter((f) => f.isRequired);
    const completedFields = fields.filter((f) =>
      signatures.some((s) => s.fieldId === f._id)
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

/**
 * Get all versions for a document, ordered by version number descending (newest first)
 * Enriched with creator user info (name, email, avatar)
 */
export const getDocumentVersions = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Access check — ensures user can view this document
    await getDocumentWithAccessCheck(ctx, userId, args.documentId);

    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — getDocumentVersions must return the complete version history for this single documentId; no caller receives fewer rows. bound=global
    const versions = await ctx.db
      .query("document_versions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

    // Enrich with creator user info
    const enrichedVersions = await Promise.all(
      versions.map(async (version) => {
        const creator = await ctx.db.get(version.createdBy);
        return {
          ...version,
          creator: creator
            ? {
                _id: creator._id,
                name: creator.name,
                email: creator.email,
                avatar: creator.avatar,
              }
            : null,
        };
      })
    );

    return enrichedVersions;
  },
});

/**
 * Get a single version by document + version number
 * Includes a storage URL for the snapshot's PDF
 */
export const getDocumentVersion = authQuery({
  args: {
    documentId: v.id("documents"),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Access check
    await getDocumentWithAccessCheck(ctx, userId, args.documentId);

    const version = await ctx.db
      .query("document_versions")
      .withIndex("by_document", (q) =>
        q
          .eq("documentId", args.documentId)
          .eq("versionNumber", args.versionNumber)
      )
      .first();

    if (!version) {
      throw new ConvexError(`Version ${args.versionNumber} not found`);
    }

    // Get storage URL and creator info in parallel
    const [storageUrl, creator] = await Promise.all([
      ctx.storage.getUrl(version.snapshot.storageId),
      ctx.db.get(version.createdBy),
    ]);

    return {
      ...version,
      storageUrl,
      creator: creator
        ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
            avatar: creator.avatar,
          }
        : null,
    };
  },
});

/**
 * Get document URL for public signing page (no auth required)
 * Validates access via signing token
 */
export const getDocumentUrlByToken = query({
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

    // 3. Get the document
    const document = await ctx.db.get(recipient.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 4. Generate download URL from storage
    const url = await ctx.storage.getUrl(document.storageId);
    if (!url) {
      throw new ConvexError("File not found in storage");
    }

    return url;
  },
});

/**
 * Full-text search across document content
 * Uses Convex search index on extractedText
 */
export const searchDocuments = authQuery({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const maxResults = args.limit ?? 20;

    const results = await ctx.db
      .query("documents")
      .withSearchIndex("search_text", (q) =>
        q
          .search("extractedText", args.query)
          .eq("organizationId", organizationId)
          .eq("status", "active")
      )
      .take(maxResults);

    return results.map((doc) => ({
      _id: doc._id,
      name: doc.name,
      description: doc.description,
      workflowStatus: doc.workflowStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  },
});

/**
 * Internal query to get a document by ID without access control
 * Used by actions that need to access documents
 */

export const getDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }
    return document;
  },
});
