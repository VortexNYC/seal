/**
 * Document mutations for Seal - Document Sharing
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { logDocumentAction } from "../audit_logs/helpers";
import { authMutation, permissionMutation } from "../auth";
import { ensureDocumentLimit, ensureStorageLimit } from "../auth/subscription_guards";
import { validateFile } from "./upload_config";
import {
  canCancelDocument,
  canCompleteDocument,
  canSendDocument,
  transitionWorkflowStatus,
  verifyDocumentOwnership,
} from "./workflow_helpers";

/**
 * Generate an upload URL for document storage
 * This allows the client to upload a file directly to Convex Storage
 */
export const generateUploadUrl = authMutation({
  args: {},
  handler: async (ctx) => {
    // User must be authenticated (authMutation ensures this)
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a document record after file upload
 * Called after the client successfully uploads the file to Convex Storage
 * Requires documents:create permission
 */
export const createDocument = permissionMutation("documents:create")({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    fileSize: v.number(),
    fileType: v.string(),
    storageId: v.string(), // ID returned from storage upload
    pageCount: v.optional(v.number()), // Number of pages in PDF (SEA-64)
    thumbnailDataUrl: v.optional(v.string()), // Base64 data URL of thumbnail (SEA-69)
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Validate file before processing
    const validation = validateFile(args.name, args.fileType, args.fileSize);
    if (!validation.valid) {
      throw new ConvexError(`File validation failed: ${validation.errors.join(", ")}`);
    }

    // 2. Verify user is a member of the organization
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!member) {
      throw new ConvexError("You are not a member of this organization");
    }

    if (member.status !== "active") {
      throw new ConvexError("Your organization membership is not active");
    }

    // 3. Check subscription limits
    await ensureDocumentLimit(ctx.db, userId);
    await ensureStorageLimit(ctx.db, userId, args.fileSize);

    // 4. Create the document record (default to private sharing)
    const documentId = await ctx.db.insert("documents", {
      organizationId: args.organizationId,
      ownerId: userId,
      name: args.name,
      description: args.description,
      fileSize: args.fileSize,
      fileType: args.fileType,
      storageId: args.storageId,
      pageCount: args.pageCount, // SEA-64: Store page count
      thumbnailDataUrl: args.thumbnailDataUrl, // SEA-69: Store thumbnail
      sharingMode: "private", // Default to private
      status: "active",
      workflowStatus: "draft", // Default to draft workflow status
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Audit trail
    await logDocumentAction(ctx, {
      organizationId: args.organizationId,
      userId: ctx.auth.user.clerkId,
      action: "document.created",
      documentId,
      newValues: { name: args.name, fileType: args.fileType },
      description: "Document created",
      ipAddress: "web-authenticated",
    });

    return documentId;
  },
});

/**
 * Delete a document (marks as deleted, can archive storage later)
 * Requires documents:delete permission
 */
export const deleteDocument = permissionMutation("documents:delete")({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 2. Verify user is the owner (only owners can delete)
    if (document.ownerId !== userId) {
      throw new ConvexError("Only the document owner can delete this document");
    }

    // 3. Mark as deleted (soft delete)
    await ctx.db.patch(args.documentId, {
      status: "deleted",
      updatedAt: Date.now(),
    });

    // 4. Verify storage exists before scheduling cleanup
    const storageUrl = await ctx.storage.getUrl(document.storageId);
    if (!storageUrl) {
      console.warn(`Storage ${document.storageId} not found for document ${args.documentId}`);
      return { success: true, warning: "storage_already_deleted" };
    }

    // 5. Schedule storage cleanup after 7 day grace period
    // This allows document recovery if needed
    const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    await ctx.scheduler.runAfter(
      GRACE_PERIOD_MS,
      internal.documents?.cleanup.cleanupDocumentStorage,
      {
        storageId: document.storageId,
        documentId: args.documentId,
      },
    );

    return { success: true };
  },
});

/**
 * Update document metadata (name, description)
 * Requires documents:edit permission
 */
export const updateDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 2. Check if user has edit access (owner or has "edit"/"manage" permission)
    let hasEditAccess = false;
    if (document.ownerId !== userId) {
      const access = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", args.documentId).eq("userId", userId),
        )
        .first();

      hasEditAccess =
        access !== null &&
        (access.permissionLevel === "edit" || access.permissionLevel === "manage");
    }

    if (!hasEditAccess && document.ownerId !== userId) {
      throw new ConvexError("You don't have permission to edit this document");
    }

    // 3. Update the document
    const updateData: {
      name?: string;
      description?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updateData.name = args.name;
    }
    if (args.description !== undefined) {
      updateData.description = args.description;
    }

    await ctx.db.patch(args.documentId, updateData);

    return { success: true };
  },
});

/**
 * Update document thumbnail
 * Used for lazy thumbnail generation from existing documents
 */
export const updateThumbnail = authMutation({
  args: {
    documentId: v.id("documents"),
    thumbnailDataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 2. Verify user has access (owner or org member)
    let hasAccess = document.ownerId === userId;

    if (!hasAccess) {
      const member = await ctx.db
        .query("organization_members")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", document.organizationId),
        )
        .first();

      hasAccess = member !== null && member.status === "active";
    }

    if (!hasAccess) {
      throw new ConvexError("You don't have access to this document");
    }

    // 3. Update thumbnail
    await ctx.db.patch(args.documentId, {
      thumbnailDataUrl: args.thumbnailDataUrl,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Send a document to recipients
 * Transitions workflow status from draft to sent
 * Requires documents:edit permission (owner operation)
 */
export const sendDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 3. Verify document is in draft status (default to draft for migration)
    const currentStatus = document.workflowStatus ?? "draft";
    if (!canSendDocument(currentStatus)) {
      throw new ConvexError(`Cannot send document with status: ${currentStatus}`);
    }

    // 4. Transition to sent status
    await transitionWorkflowStatus(ctx, args.documentId, "sent");

    // TODO: When recipients are implemented (SEA-127):
    // - Verify document has at least one recipient
    // - Generate signing tokens for recipients
    // - Send email notifications

    return { success: true };
  },
});

/**
 * Cancel a document workflow
 * Can be called by owner at any time before completion
 * Requires documents:edit permission
 */
export const cancelDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 3. Verify document can be cancelled (default to draft for migration)
    const currentStatus = document.workflowStatus ?? "draft";
    if (!canCancelDocument(currentStatus)) {
      throw new ConvexError(`Cannot cancel document with status: ${currentStatus}`);
    }

    // 4. Transition to cancelled status
    await transitionWorkflowStatus(ctx, args.documentId, "cancelled");

    // TODO: When recipients are implemented (SEA-127):
    // - Notify all recipients about cancellation
    // - Invalidate signing tokens

    return { success: true };
  },
});

/**
 * Mark a document as completed
 * Called when all required signatures have been collected
 * Requires documents:edit permission
 */
export const completeDocument = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 3. Verify document can be completed (default to draft for migration)
    const currentStatus = document.workflowStatus ?? "draft";
    if (!canCompleteDocument(currentStatus)) {
      throw new ConvexError(`Cannot complete document with status: ${currentStatus}`);
    }

    // TODO: When recipients are implemented (SEA-127):
    // - Verify all required signers have signed
    // - Cannot complete if any required signatures are missing

    // 4. Transition to completed status
    await transitionWorkflowStatus(ctx, args.documentId, "completed");

    // TODO: When email is implemented:
    // - Notify all participants about completion
    // - Send final signed document copy

    return { success: true };
  },
});

/**
 * Internal mutation to update the document hash
 * Called by hashDocument action
 *
 * SEA-108: Digital Signature Implementation
 */
export const updateDocumentHash = internalMutation({
  args: {
    documentId: v.id("documents"),
    documentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      documentHash: args.documentHash,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update the signed storage ID
 * Called by PDF signing actions
 *
 * SEA-108: Digital Signature Implementation
 */
export const updateSignedStorageId = internalMutation({
  args: {
    documentId: v.id("documents"),
    signedStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Delete old signed PDF if it exists
    if (document.signedStorageId) {
      try {
        await ctx.storage.delete(document.signedStorageId as Id<"_storage">);
      } catch {
        console.warn(`Could not delete old signed PDF: ${document.signedStorageId}`);
      }
    }

    await ctx.db.patch(args.documentId, {
      signedStorageId: args.signedStorageId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update the fillable storage ID
 * Called by generateAndStoreFillablePdf action
 *
 * SEA-100: Embed Fields in PDF
 */
export const updateFillableStorageId = internalMutation({
  args: {
    documentId: v.id("documents"),
    fillableStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Delete the old fillable PDF if it exists
    if (document.fillableStorageId) {
      try {
        await ctx.storage.delete(document.fillableStorageId as Id<"_storage">);
      } catch {
        // Ignore errors if the old file doesn't exist
        console.warn(`Could not delete old fillable PDF: ${document.fillableStorageId}`);
      }
    }

    await ctx.db.patch(args.documentId, {
      fillableStorageId: args.fillableStorageId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
