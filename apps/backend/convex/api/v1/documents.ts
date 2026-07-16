/**
 * @fileoverview Documents REST API internal queries and handlers.
 * Provides CRUD operations for documents via the public API.
 *
 * @module api/v1/documents
 * @requires seal:documents:read scope for GET operations
 * @requires seal:documents:write scope for POST/PUT/DELETE operations
 */

import { v } from "convex/values";

import { internal } from "../../_generated/api";
import { internalMutation, internalQuery } from "../../_generated/server";
import type { DocumentWorkflowStatus } from "../../schemas/document_workflow_status";
import { publishWebhookEvent } from "../../webhooks/publish";
import { workflow } from "../../workflows";

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
    | "waiting_for_payment"
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
    title_search: v.optional(v.string()),
    created_after: v.optional(v.string()),
    created_before: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    documents: ApiDocument[];
    hasMore: boolean;
    nextCursor?: string;
  }> => {
    const limit = args.limit ?? 20;

    // When filters are active, fetch more to ensure we can fill the page after post-filtering
    const hasFilters = !!(
      args.status ||
      args.title_search ||
      args.created_after ||
      args.created_before
    );
    const fetchLimit = hasFilters ? Math.min(limit * 5, 500) : limit + 1;

    // Get documents for the organization
    let query = ctx.db
      .query("documents")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .order("desc");

    // Apply cursor if provided (use _creationTime for index-based pagination)
    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor as Parameters<typeof ctx.db.get>[0]);
      if (cursorDoc) {
        query = query.filter((q) => q.lt(q.field("_creationTime"), cursorDoc._creationTime));
      }
    }

    const documents = await query.take(fetchLimit);

    // Apply post-filters
    const createdAfterMs = args.created_after ? new Date(args.created_after).getTime() : undefined;
    const createdBeforeMs = args.created_before
      ? new Date(args.created_before).getTime()
      : undefined;
    const titleSearch = args.title_search?.toLowerCase();

    const filteredDocs = documents.filter((doc) => {
      if (args.status && (doc.workflowStatus ?? "draft") !== args.status) return false;
      if (titleSearch && !doc.name.toLowerCase().includes(titleSearch)) return false;
      if (createdAfterMs !== undefined && doc.createdAt < createdAfterMs) return false;
      if (createdBeforeMs !== undefined && doc.createdAt > createdBeforeMs) return false;
      return true;
    });

    const hasMore = filteredDocs.length > limit;
    const resultDocs = hasMore ? filteredDocs.slice(0, limit) : filteredDocs;

    // Get recipient counts for each document
    const apiDocuments: ApiDocument[] = await Promise.all(
      resultDocs.map(async (doc) => {
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
          deadline: doc.deadline ? new Date(doc.deadline).toISOString() : undefined,
        };
      }),
    );

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
      deadline: document.deadline ? new Date(document.deadline).toISOString() : undefined,
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
        error: "Only draft documents can be deleted. Use void to cancel sent documents.",
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

    // Publish webhook event unconditionally — don't gate on email success
    await publishWebhookEvent(ctx, {
      organizationId: args.organizationId,
      eventType: "document.sent",
      data: {
        document_id: args.documentId,
        name: document.name,
        recipient_count: recipients.length,
        sent_at: new Date().toISOString(),
      },
    });

    // Schedule email sending as a background action
    await ctx.scheduler.runAfter(
      0,
      internal.documents.send_document_action.sendDocumentEmailsInternal,
      {
        documentId: args.documentId,
        customMessage: args.message,
      },
    );

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

    // Publish webhook event unconditionally
    await publishWebhookEvent(ctx, {
      organizationId: args.organizationId,
      eventType: "document.voided",
      data: {
        document_id: args.documentId,
        name: document.name,
        reason: args.reason,
        voided_at: new Date().toISOString(),
      },
    });

    // Start cancellation workflow with durable retry
    await workflow.start(
      ctx,
      internal.workflows.document_cancellation.documentCancellationWorkflow,
      {
        documentId: args.documentId,
        reason: args.reason,
      },
    );

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

// =============================================================================
// Document Access / Sharing Mode
// =============================================================================

/** Sharing mode for a document */
export type DocumentSharingMode = "private" | "workspace" | "specific";

/** API response for document access/sharing configuration */
export interface ApiDocumentAccess {
  /** Document ID */
  document_id: string;
  /**
   * Who can access this document:
   * - "private" — owner only
   * - "workspace" — all org members (Pro plan)
   * - "specific" — only explicitly granted users (Pro plan)
   */
  sharing_mode: DocumentSharingMode;
}

/**
 * Internal query to get a document's sharing mode.
 *
 * @internal
 */
export const getDocumentAccess = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<ApiDocumentAccess | null> => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") return null;
    if (document.organizationId !== args.organizationId) return null;

    return {
      document_id: args.documentId,
      sharing_mode: (document.sharingMode ?? "private") as DocumentSharingMode,
    };
  },
});

/**
 * Internal mutation to update a document's sharing mode.
 * Can be changed on any document that isn't deleted.
 *
 * @internal
 */
export const updateDocumentAccess = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    sharing_mode: v.union(v.literal("private"), v.literal("workspace"), v.literal("specific")),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") throw new Error("Document not found");
    if (document.organizationId !== args.organizationId) throw new Error("Document not found");

    await ctx.db.patch(args.documentId, {
      sharingMode: args.sharing_mode,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// =============================================================================
// Bulk Document Operations
// =============================================================================

/** Result of a single item in a bulk operation */
interface BulkOperationResult {
  id: string;
  success: boolean;
  error?: string;
}

/** Summary returned from a bulk operation */
export interface BulkOperationSummary {
  succeeded: number;
  failed: number;
  total_requested: number;
  results: BulkOperationResult[];
}

/**
 * Internal mutation to void multiple documents at once.
 *
 * @internal
 */
export const bulkVoidDocuments = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    document_ids: v.array(v.id("documents")),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<BulkOperationSummary> => {
    const results: BulkOperationResult[] = [];

    for (const documentId of args.document_ids) {
      const document = await ctx.db.get(documentId);

      if (!document || document.status === "deleted") {
        results.push({ id: documentId, success: false, error: "Document not found" });
        continue;
      }

      if (document.organizationId !== args.organizationId) {
        results.push({ id: documentId, success: false, error: "Document not found" });
        continue;
      }

      const status = document.workflowStatus ?? "draft";
      if (status === "completed" || status === "cancelled" || status === "declined") {
        results.push({
          id: documentId,
          success: false,
          error: `Cannot void document with status: ${status}`,
        });
        continue;
      }

      await ctx.db.patch(documentId, {
        workflowStatus: "cancelled",
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });

      results.push({ id: documentId, success: true });
    }

    const succeeded = results.filter((r) => r.success).length;

    return {
      succeeded,
      failed: results.length - succeeded,
      total_requested: results.length,
      results,
    };
  },
});

/**
 * Internal mutation to send multiple draft documents at once.
 * Each document must have at least one recipient.
 *
 * @internal
 */
export const bulkSendDocuments = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    document_ids: v.array(v.id("documents")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<BulkOperationSummary> => {
    const results: BulkOperationResult[] = [];

    for (const documentId of args.document_ids) {
      const document = await ctx.db.get(documentId);

      if (!document || document.status === "deleted") {
        results.push({ id: documentId, success: false, error: "Document not found" });
        continue;
      }

      if (document.organizationId !== args.organizationId) {
        results.push({ id: documentId, success: false, error: "Document not found" });
        continue;
      }

      const status = document.workflowStatus ?? "draft";
      if (status !== "draft") {
        results.push({
          id: documentId,
          success: false,
          error: `Document is not in draft status (current: ${status})`,
        });
        continue;
      }

      const recipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .collect();

      if (recipients.length === 0) {
        results.push({
          id: documentId,
          success: false,
          error: "Document has no recipients",
        });
        continue;
      }

      await ctx.db.patch(documentId, {
        workflowStatus: "sent",
        sentAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Schedule sending emails for each recipient via existing workflow
      await ctx.scheduler.runAfter(
        0,
        internal.documents.send_document_action.sendDocumentEmailsInternal,
        { documentId, customMessage: args.message },
      );

      results.push({ id: documentId, success: true });
    }

    const succeeded = results.filter((r) => r.success).length;

    return {
      succeeded,
      failed: results.length - succeeded,
      total_requested: results.length,
      results,
    };
  },
});
