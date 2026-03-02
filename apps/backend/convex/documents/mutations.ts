/**
 * Document mutations for Seal - Document Sharing
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import type { DatabaseReader } from "../_generated/server";
import { enqueueAiPipeline } from "../ai/workpool";
import { logDocumentAction } from "../audit_logs/helpers";
import { authMutation, permissionMutation } from "../auth";
import { ensureDocumentLimit, ensureStorageLimit } from "../auth/subscription_guards";
import { retrier } from "../retrier";
import { expirationPeriodToMs } from "./send_document_action";
import { validateFile } from "./upload_config";
import { createVersionSnapshot } from "./version_helpers";
import {
  canCancelDocument,
  canCompleteDocument,
  canSendDocument,
  transitionWorkflowStatus,
  verifyDocumentOwnership,
} from "./workflow_helpers";

/** Check if the org has AI auto-analyze enabled (defaults to true). */
async function shouldAutoAnalyze(db: DatabaseReader, organizationId: Id<"organizations">) {
  const org = await db.get(organizationId);
  return org?.aiSettings?.aiAutoAnalyze !== false;
}

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
      currentVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 5. Insert initial version snapshot
    await createVersionSnapshot(ctx, {
      documentId,
      createdBy: userId,
      changeType: "created",
      changeDescription: "Initial document upload",
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

    // 6. Schedule SHA-256 hash computation for document integrity baseline
    // Runs as an action since it needs to download the PDF from storage
    await retrier.run(ctx, internal.documents.hash_document_action.hashDocument, {
      documentId,
    });

    // 7. Schedule PDF text extraction for search indexing
    await retrier.run(ctx, internal.documents.extract_text_action.extractDocumentText, {
      documentId,
    });

    // 8. Schedule AI field analysis pipeline (if auto-analyze is on)
    if (await shouldAutoAnalyze(ctx.db, args.organizationId)) {
      await enqueueAiPipeline(ctx, ctx.db, documentId, args.organizationId, ctx.auth.user._id);
      await ctx.db.patch(documentId, { aiProcessingStatus: "pending" });
    }

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

    // 2b. Enforce retention policy — completed documents cannot be deleted within retention period
    if (document.retainUntil && document.retainUntil > Date.now()) {
      const retainDate = new Date(document.retainUntil).toLocaleDateString("en-US");
      throw new ConvexError({
        code: "RETENTION_POLICY",
        message: `This document is under a legal retention policy and cannot be deleted until ${retainDate}. Completed documents must be retained for 7 years per ESIGN Act compliance.`,
      });
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
    redirectUrl: v.optional(v.union(v.string(), v.null())),
    allowDictateNextSigner: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 2. Block modifications to completed documents (immutable after signing)
    if (document.workflowStatus === "completed") {
      throw new ConvexError({
        code: "DOCUMENT_IMMUTABLE",
        message: "Completed documents cannot be modified. They are immutable for legal compliance.",
      });
    }

    // 3. Check if user has edit access (owner or has "edit"/"manage" permission)
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

    // 3. Validate redirectUrl if provided
    if (args.redirectUrl) {
      try {
        const parsed = new URL(args.redirectUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new ConvexError("Redirect URL must use http or https protocol");
        }
      } catch {
        throw new ConvexError("Redirect URL must be a valid URL");
      }
      if (args.redirectUrl.length > 2048) {
        throw new ConvexError("Redirect URL must be 2048 characters or less");
      }
    }

    // 4. Update the document
    const updateData: {
      name?: string;
      description?: string;
      redirectUrl?: string;
      allowDictateNextSigner?: boolean;
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
    if (args.redirectUrl !== undefined) {
      // null means "clear the field" — patch with undefined to remove it from the document
      updateData.redirectUrl = args.redirectUrl === null ? undefined : args.redirectUrl;
    }
    if (args.allowDictateNextSigner !== undefined) {
      updateData.allowDictateNextSigner = args.allowDictateNextSigner;
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

    // 2. Block modifications to completed documents (immutable after signing)
    if (document.workflowStatus === "completed") {
      throw new ConvexError({
        code: "DOCUMENT_IMMUTABLE",
        message: "Completed documents cannot be modified. They are immutable for legal compliance.",
      });
    }

    // 3. Verify user has access (owner or org member)
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

    // 3. Verify document can be sent (draft or expired)
    const currentStatus = document.workflowStatus ?? "draft";
    if (!canSendDocument(currentStatus)) {
      throw new ConvexError(`Cannot send document with status: ${currentStatus}`);
    }

    // 4. If re-sending an expired document, reset expired recipients
    if (currentStatus === "expired") {
      const recipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .collect();

      const now = Date.now();
      const newExpiresAt = document.expirationPeriod
        ? now +
          expirationPeriodToMs(document.expirationPeriod.amount, document.expirationPeriod.unit)
        : undefined;

      for (const recipient of recipients) {
        if (recipient.status === "expired") {
          await ctx.db.patch(recipient._id, {
            status: "pending",
            expiresAt: newExpiresAt,
            expirationNotifiedAt: undefined,
            updatedAt: now,
          });
        }
      }
    }

    // 5. Transition to sent status
    await transitionWorkflowStatus(ctx, args.documentId, "sent");

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

    // 4. Transition to completed status
    await transitionWorkflowStatus(ctx, args.documentId, "completed");

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
 * Internal mutation to store extracted text from PDF
 * Called by extractText action
 */
export const updateExtractedText = internalMutation({
  args: {
    documentId: v.id("documents"),
    extractedText: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      extractedText: args.extractedText,
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

/**
 * Replace a document's PDF file
 * Snapshots the current state into document_versions before replacing.
 * Only works on draft documents — sent/completed documents are immutable.
 * Requires documents:edit permission
 */
export const replaceDocumentPdf = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    storageId: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    pageCount: v.optional(v.number()),
    changeDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document and verify ownership
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    if (document.ownerId !== userId) {
      throw new ConvexError("Only the document owner can replace the PDF");
    }

    // 2. Only draft documents can have their PDF replaced
    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus !== "draft") {
      throw new ConvexError({
        code: "DOCUMENT_IMMUTABLE",
        message: `Cannot replace PDF of a document with status: ${workflowStatus}. Only draft documents can be modified.`,
      });
    }

    // 3. Validate the new file
    const validation = validateFile(document.name, args.fileType, args.fileSize);
    if (!validation.valid) {
      throw new ConvexError(`File validation failed: ${validation.errors.join(", ")}`);
    }

    // 4. Snapshot current state before replacing
    const newVersionNumber = await createVersionSnapshot(ctx, {
      documentId: args.documentId,
      createdBy: userId,
      changeType: "replaced",
      changeDescription: args.changeDescription ?? "PDF replaced",
    });

    // 5. Update document with new PDF
    await ctx.db.patch(args.documentId, {
      storageId: args.storageId,
      fileSize: args.fileSize,
      fileType: args.fileType,
      pageCount: args.pageCount,
      currentVersion: newVersionNumber,
      // Clear derived fields — they'll be recomputed
      documentHash: undefined,
      extractedText: undefined,
      fillableStorageId: undefined,
      thumbnailDataUrl: undefined,
      updatedAt: Date.now(),
    });

    // 6. Audit trail
    await logDocumentAction(ctx, {
      organizationId: document.organizationId,
      userId: ctx.auth.user.clerkId,
      action: "document.updated",
      documentId: args.documentId,
      newValues: { currentVersion: newVersionNumber, storageId: args.storageId },
      description: `PDF replaced (v${newVersionNumber})`,
      ipAddress: "web-authenticated",
    });

    // 7. Schedule hash computation + text extraction for new PDF
    await retrier.run(ctx, internal.documents.hash_document_action.hashDocument, {
      documentId: args.documentId,
    });

    await retrier.run(ctx, internal.documents.extract_text_action.extractDocumentText, {
      documentId: args.documentId,
    });

    // 8. Schedule AI field analysis for new PDF (if auto-analyze is on)
    if (await shouldAutoAnalyze(ctx.db, document.organizationId)) {
      await enqueueAiPipeline(
        ctx,
        ctx.db,
        args.documentId,
        document.organizationId,
        ctx.auth.user._id,
      );
      await ctx.db.patch(args.documentId, { aiProcessingStatus: "pending" });
    }

    return { success: true, versionNumber: newVersionNumber };
  },
});

/**
 * Restore a document to a previous version
 * Creates a new version entry (never overwrites) with changeType "restored".
 * Only works on draft documents.
 * Requires documents:edit permission
 */
export const restoreDocumentVersion = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    targetVersionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document and verify ownership
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    if (document.ownerId !== userId) {
      throw new ConvexError("Only the document owner can restore versions");
    }

    // 2. Only draft documents can be restored
    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus !== "draft") {
      throw new ConvexError({
        code: "DOCUMENT_IMMUTABLE",
        message: `Cannot restore a document with status: ${workflowStatus}. Only draft documents can be modified.`,
      });
    }

    // 3. Find the target version
    const targetVersion = await ctx.db
      .query("document_versions")
      .withIndex("by_document", (q) =>
        q.eq("documentId", args.documentId).eq("versionNumber", args.targetVersionNumber),
      )
      .first();

    if (!targetVersion) {
      throw new ConvexError(`Version ${args.targetVersionNumber} not found for this document`);
    }

    // 4. Snapshot current state before restoring (creates the "before restore" version)
    const newVersionNumber = await createVersionSnapshot(ctx, {
      documentId: args.documentId,
      createdBy: userId,
      changeType: "restored",
      changeDescription: `Restored from version ${args.targetVersionNumber}`,
      restoredFromVersion: args.targetVersionNumber,
    });

    // 5. Restore the snapshot data to the document
    await ctx.db.patch(args.documentId, {
      name: targetVersion.snapshot.name,
      description: targetVersion.snapshot.description,
      storageId: targetVersion.snapshot.storageId,
      fileSize: targetVersion.snapshot.fileSize,
      fileType: targetVersion.snapshot.fileType,
      pageCount: targetVersion.snapshot.pageCount,
      currentVersion: newVersionNumber,
      // Clear derived fields — they'll be recomputed from the restored PDF
      documentHash: undefined,
      extractedText: undefined,
      fillableStorageId: undefined,
      thumbnailDataUrl: undefined,
      updatedAt: Date.now(),
    });

    // 6. Audit trail
    await logDocumentAction(ctx, {
      organizationId: document.organizationId,
      userId: ctx.auth.user.clerkId,
      action: "document.updated",
      documentId: args.documentId,
      newValues: {
        currentVersion: newVersionNumber,
        storageId: targetVersion.snapshot.storageId,
      },
      description: `Restored to v${args.targetVersionNumber} (now v${newVersionNumber})`,
      ipAddress: "web-authenticated",
    });

    // 7. Schedule hash computation + text extraction for restored PDF
    await retrier.run(ctx, internal.documents.hash_document_action.hashDocument, {
      documentId: args.documentId,
    });

    await retrier.run(ctx, internal.documents.extract_text_action.extractDocumentText, {
      documentId: args.documentId,
    });

    // 8. Schedule AI field analysis for restored PDF (if auto-analyze is on)
    if (await shouldAutoAnalyze(ctx.db, document.organizationId)) {
      await enqueueAiPipeline(
        ctx,
        ctx.db,
        args.documentId,
        document.organizationId,
        ctx.auth.user._id,
      );
      await ctx.db.patch(args.documentId, { aiProcessingStatus: "pending" });
    }

    return { success: true, versionNumber: newVersionNumber };
  },
});
