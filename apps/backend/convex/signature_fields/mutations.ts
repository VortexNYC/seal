import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { logFieldAction } from "../audit_logs/helpers";
import { findRecipientByToken } from "../documents/recipient_helpers";
import { findExistingPaymentFieldForRecipient } from "../payment_fields/helpers";
import { fieldTypeTuple } from "../schemas/signature_fields";
import {
  validateFieldAssignment,
  validateFieldPosition,
  validateFieldType,
  validatePageNumber,
} from "./helpers";
import { pushFieldSnapshot } from "./timeline_helpers";

/**
 * Verify that document is in draft status before allowing field modifications
 */
function verifyDocumentIsDraft(document: Doc<"documents">): void {
  const workflowStatus = document.workflowStatus ?? "draft";
  if (workflowStatus !== "draft") {
    throw new ConvexError(
      `Cannot modify fields - document is ${workflowStatus}. Fields can only be modified in draft status.`
    );
  }
}

async function ensureCreateFieldIsValid(
  ctx: MutationCtx,
  args: {
    documentId: Id<"documents">;
    recipientId?: Id<"document_recipients">;
    fieldType: Doc<"signature_fields">["fieldType"];
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    properties?: Doc<"signature_fields">["properties"];
  }
): Promise<void> {
  const positionValidation = validateFieldPosition(
    args.x,
    args.y,
    args.width,
    args.height
  );
  if (!positionValidation.valid) {
    throw new Error(positionValidation.error);
  }

  const pageValidation = await validatePageNumber(
    ctx,
    args.documentId,
    args.page
  );
  if (!pageValidation.valid) {
    throw new Error(pageValidation.error);
  }

  if (args.recipientId) {
    const assignmentValidation = await validateFieldAssignment(
      ctx,
      args.documentId,
      args.recipientId
    );
    if (!assignmentValidation.valid) {
      throw new Error(assignmentValidation.error);
    }
  }

  const typeValidation = validateFieldType(args.fieldType, args.properties);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }
}

async function ensureRecipientHasNoPaymentField(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  recipientId: Id<"document_recipients">
): Promise<void> {
  const existingPaymentField = await findExistingPaymentFieldForRecipient(
    ctx,
    documentId,
    recipientId
  );
  if (existingPaymentField) {
    throw new ConvexError("Each recipient can only have one payment field");
  }
}

async function determineMainSignatureField(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  recipientId?: Id<"document_recipients">,
  fieldType?: Doc<"signature_fields">["fieldType"]
): Promise<boolean | undefined> {
  if (fieldType !== "signature" || !recipientId) {
    return undefined;
  }

  const existingSignatureFields: Doc<"signature_fields">[] = [];
  for await (const field of ctx.db
    .query("signature_fields")
    .withIndex("by_document_recipient", (q) =>
      q.eq("documentId", documentId).eq("recipientId", recipientId)
    )) {
    if (field.fieldType === "signature") {
      existingSignatureFields.push(field);
    }
  }

  return existingSignatureFields.length === 0 ? true : undefined;
}

/**
 * Signature Field Mutations
 *
 * Create, update, delete, and reposition signature fields on documents.
 *
 * SEA-31: Database Schemas - Signature Fields CRUD Operations
 */

/**
 * Create a new signature field on a document
 */
export const createField = mutation({
  args: {
    documentId: v.id("documents"),
    recipientId: v.optional(v.id("document_recipients")),
    fieldType: fieldTypeTuple,
    label: v.string(),
    isRequired: v.boolean(),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    page: v.number(),
    properties: v.optional(
      v.object({
        placeholder: v.optional(v.string()),
        defaultValue: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        maxLength: v.optional(v.number()),
        minLength: v.optional(v.number()),
        pattern: v.optional(v.string()),
        helpText: v.optional(v.string()),
      })
    ),
    validationRules: v.optional(
      v.object({
        required: v.optional(v.boolean()),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
        pattern: v.optional(v.string()),
        customMessage: v.optional(v.string()),
      })
    ),
    templateFieldId: v.optional(v.id("template_fields")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get document and verify access
    const document = await ctx.db.get("documents", args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document is in draft status
    verifyDocumentIsDraft(document);

    await ensureCreateFieldIsValid(ctx, args);

    // Guard: only one payment field per recipient (only when assigned)
    if (args.fieldType === "payment" && args.recipientId) {
      await ensureRecipientHasNoPaymentField(
        ctx,
        args.documentId,
        args.recipientId
      );
    }

    // Auto-designate main signature if this is the first signature field for this recipient
    const isMainSignature = await determineMainSignatureField(
      ctx,
      args.documentId,
      args.recipientId,
      args.fieldType
    );

    // Create field
    const fieldId = await ctx.db.insert("signature_fields", {
      documentId: args.documentId,
      recipientId: args.recipientId,
      fieldType: args.fieldType,
      label: args.label,
      isRequired: args.isRequired,
      isMainSignature,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      page: args.page,
      properties: args.properties,
      validationRules: args.validationRules,
      templateFieldId: args.templateFieldId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Log action to audit trail
    await logFieldAction(ctx, {
      organizationId: document.organizationId,
      userId: identity.subject,
      action: "field.created",
      fieldId,
      documentId: args.documentId,
      recipientId: args.recipientId,
      newValues: { fieldType: args.fieldType, label: args.label },
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    await pushFieldSnapshot(ctx, args.documentId);

    return fieldId;
  },
});

/**
 * Update a signature field's properties
 */
export const updateField = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    label: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    properties: v.optional(
      v.object({
        placeholder: v.optional(v.string()),
        defaultValue: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        maxLength: v.optional(v.number()),
        minLength: v.optional(v.number()),
        pattern: v.optional(v.string()),
        helpText: v.optional(v.string()),
      })
    ),
    validationRules: v.optional(
      v.object({
        required: v.optional(v.boolean()),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
        pattern: v.optional(v.string()),
        customMessage: v.optional(v.string()),
      })
    ),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get existing field
    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Get document and verify access
    const document = await ctx.db.get("documents", field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document is in draft status
    verifyDocumentIsDraft(document);

    // Validate field type if properties are being updated
    if (args.properties) {
      const typeValidation = validateFieldType(
        field.fieldType,
        args.properties
      );
      if (!typeValidation.valid) {
        throw new Error(typeValidation.error);
      }
    }

    // Store old values for audit
    const oldValues = {
      label: field.label,
      isRequired: field.isRequired,
      properties: field.properties,
      validationRules: field.validationRules,
    };

    // Update field
    await ctx.db.patch("signature_fields", args.fieldId, {
      ...(args.label !== undefined && { label: args.label }),
      ...(args.isRequired !== undefined && { isRequired: args.isRequired }),
      ...(args.properties !== undefined && { properties: args.properties }),
      ...(args.validationRules !== undefined && {
        validationRules: args.validationRules,
      }),
      updatedAt: Date.now(),
    });

    // Log action to audit trail
    await logFieldAction(ctx, {
      organizationId: document.organizationId,
      userId: identity.subject,
      action: "field.updated",
      fieldId: args.fieldId,
      documentId: field.documentId,
      recipientId: field.recipientId,
      oldValues,
      newValues: {
        label: args.label,
        isRequired: args.isRequired,
        properties: args.properties,
        validationRules: args.validationRules,
      },
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    await pushFieldSnapshot(ctx, field.documentId);

    return args.fieldId;
  },
});

/**
 * Reposition a signature field (move or resize)
 */
export const repositionField = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    page: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get existing field
    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Get document and verify access
    const document = await ctx.db.get("documents", field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document is in draft status
    verifyDocumentIsDraft(document);

    // Calculate new position (use existing values if not provided)
    const newX = args.x ?? field.x;
    const newY = args.y ?? field.y;
    const newWidth = args.width ?? field.width;
    const newHeight = args.height ?? field.height;
    const newPage = args.page ?? field.page;

    // Validate new position
    const positionValidation = validateFieldPosition(
      newX,
      newY,
      newWidth,
      newHeight
    );
    if (!positionValidation.valid) {
      throw new Error(positionValidation.error);
    }

    // Validate page number if changed
    if (args.page !== undefined) {
      const pageValidation = await validatePageNumber(
        ctx,
        field.documentId,
        args.page
      );
      if (!pageValidation.valid) {
        throw new Error(pageValidation.error);
      }
    }

    // Store old values for audit
    const oldValues = {
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      page: field.page,
    };

    // Update field position
    await ctx.db.patch("signature_fields", args.fieldId, {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      page: newPage,
      updatedAt: Date.now(),
    });

    // Log action to audit trail
    await logFieldAction(ctx, {
      organizationId: document.organizationId,
      userId: identity.subject,
      action: "field.updated",
      fieldId: args.fieldId,
      documentId: field.documentId,
      recipientId: field.recipientId,
      oldValues,
      newValues: {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        page: newPage,
      },
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    await pushFieldSnapshot(ctx, field.documentId);

    return args.fieldId;
  },
});

/**
 * Delete a signature field
 */
export const deleteField = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get existing field
    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Get document and verify access
    const document = await ctx.db.get("documents", field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document is in draft status
    verifyDocumentIsDraft(document);

    // Check if field has signatures
    const existingSignature = await ctx.db
      .query("signatures")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .first();

    if (existingSignature) {
      throw new Error("Cannot delete field that has been signed");
    }

    // Store field data for audit
    const oldValues = {
      fieldType: field.fieldType,
      label: field.label,
      position: {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      },
    };

    // Cascade-delete payment config if this is a payment field
    if (field.fieldType === "payment") {
      const paymentConfig = await ctx.db
        .query("payment_field_configs")
        .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
        .unique();
      if (paymentConfig) {
        await ctx.db.delete("payment_field_configs", paymentConfig._id);
      }
    }

    // Delete field
    await ctx.db.delete("signature_fields", args.fieldId);

    // Log action to audit trail
    await logFieldAction(ctx, {
      organizationId: document.organizationId,
      userId: identity.subject,
      action: "field.deleted",
      fieldId: args.fieldId,
      documentId: field.documentId,
      recipientId: field.recipientId,
      oldValues,
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    await pushFieldSnapshot(ctx, field.documentId);

    return { success: true };
  },
});

/**
 * Assign an unassigned field to a recipient
 * Used when template-created fields need to be assigned to signers
 */
export const assignFieldToRecipient = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    recipientId: v.id("document_recipients"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    const document = await ctx.db.get("documents", field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    verifyDocumentIsDraft(document);

    // Validate the recipient belongs to this document
    const assignmentValidation = await validateFieldAssignment(
      ctx,
      field.documentId,
      args.recipientId
    );
    if (!assignmentValidation.valid) {
      throw new Error(assignmentValidation.error);
    }

    const oldRecipientId = field.recipientId;

    await ctx.db.patch("signature_fields", args.fieldId, {
      recipientId: args.recipientId,
      updatedAt: Date.now(),
    });

    // Auto-designate main signature if this is the first signature field for this recipient
    if (field.fieldType === "signature") {
      let existingMainSignature: Doc<"signature_fields"> | null = null;
      for await (const candidate of ctx.db
        .query("signature_fields")
        .withIndex("by_document_recipient", (q) =>
          q
            .eq("documentId", field.documentId)
            .eq("recipientId", args.recipientId)
        )) {
        if (
          candidate.fieldType === "signature" &&
          candidate.isMainSignature === true
        ) {
          existingMainSignature = candidate;
          break;
        }
      }

      if (!existingMainSignature) {
        await ctx.db.patch("signature_fields", args.fieldId, {
          isMainSignature: true,
          updatedAt: Date.now(),
        });
      }
    }

    await logFieldAction(ctx, {
      organizationId: document.organizationId,
      userId: identity.subject,
      action: "field.updated",
      fieldId: args.fieldId,
      documentId: field.documentId,
      recipientId: args.recipientId,
      oldValues: { recipientId: oldRecipientId },
      newValues: { recipientId: args.recipientId },
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    return { success: true };
  },
});

/**
 * Create multiple fields at once (useful for templates)
 */
export const bulkCreateFields = mutation({
  args: {
    fields: v.array(
      v.object({
        documentId: v.id("documents"),
        recipientId: v.optional(v.id("document_recipients")),
        fieldType: fieldTypeTuple,
        label: v.string(),
        isRequired: v.boolean(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        page: v.number(),
        properties: v.optional(
          v.object({
            placeholder: v.optional(v.string()),
            defaultValue: v.optional(v.string()),
            options: v.optional(v.array(v.string())),
            maxLength: v.optional(v.number()),
            minLength: v.optional(v.number()),
            pattern: v.optional(v.string()),
            helpText: v.optional(v.string()),
          })
        ),
        templateFieldId: v.optional(v.id("template_fields")),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Verify all documents are in draft status before creating any fields
    const documentIds = new Set(args.fields.map((f) => f.documentId));
    for (const documentId of documentIds) {
      const document = await ctx.db.get("documents", documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }
      verifyDocumentIsDraft(document);
    }

    const fieldIds: Id<"signature_fields">[] = [];

    // Create all fields
    for (const fieldData of args.fields) {
      // Validate position
      const positionValidation = validateFieldPosition(
        fieldData.x,
        fieldData.y,
        fieldData.width,
        fieldData.height
      );
      if (!positionValidation.valid) {
        throw new Error(
          `Field "${fieldData.label}": ${positionValidation.error}`
        );
      }

      // Validate page number
      const pageValidation = await validatePageNumber(
        ctx,
        fieldData.documentId,
        fieldData.page
      );
      if (!pageValidation.valid) {
        throw new Error(`Field "${fieldData.label}": ${pageValidation.error}`);
      }

      // Validate field assignment (only if assigned to a recipient)
      if (fieldData.recipientId) {
        const assignmentValidation = await validateFieldAssignment(
          ctx,
          fieldData.documentId,
          fieldData.recipientId
        );
        if (!assignmentValidation.valid) {
          throw new Error(
            `Field "${fieldData.label}": ${assignmentValidation.error}`
          );
        }
      }

      // Validate field type
      const typeValidation = validateFieldType(
        fieldData.fieldType,
        fieldData.properties
      );
      if (!typeValidation.valid) {
        throw new Error(`Field "${fieldData.label}": ${typeValidation.error}`);
      }

      // Create field
      const fieldId = await ctx.db.insert("signature_fields", {
        ...fieldData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      fieldIds.push(fieldId);
    }

    return { fieldIds, count: fieldIds.length };
  },
});

/**
 * Set a signature field as the main signature for a recipient
 * Ensures only one main signature per recipient
 */
export const setMainSignature = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get the field
    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Verify it's a signature field
    if (field.fieldType !== "signature") {
      throw new Error("Only signature fields can be set as main signature");
    }

    // Get document and verify access
    const document = await ctx.db.get("documents", field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document is in draft status
    verifyDocumentIsDraft(document);

    // If already main signature, nothing to do
    if (field.isMainSignature === true) {
      return { success: true, message: "Already set as main signature" };
    }

    // Cannot set main signature on unassigned field
    if (!field.recipientId) {
      throw new Error("Cannot set main signature on an unassigned field");
    }

    // Find any other main signature for this recipient and unset it
    let existingMainSignature: Doc<"signature_fields"> | null = null;
    for await (const candidate of ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q
          .eq("documentId", field.documentId)
          .eq("recipientId", field.recipientId)
      )) {
      if (
        candidate.fieldType === "signature" &&
        candidate.isMainSignature === true
      ) {
        existingMainSignature = candidate;
        break;
      }
    }

    if (existingMainSignature && existingMainSignature._id !== args.fieldId) {
      await ctx.db.patch("signature_fields", existingMainSignature._id, {
        isMainSignature: false,
        updatedAt: Date.now(),
      });
    }

    // Set this field as the main signature
    await ctx.db.patch("signature_fields", args.fieldId, {
      isMainSignature: true,
      updatedAt: Date.now(),
    });

    // Log action to audit trail
    await logFieldAction(ctx, {
      organizationId: document.organizationId,
      userId: identity.subject,
      action: "field.updated",
      fieldId: args.fieldId,
      documentId: field.documentId,
      recipientId: field.recipientId,
      oldValues: { isMainSignature: field.isMainSignature },
      newValues: { isMainSignature: true },
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    return { success: true, message: "Main signature updated" };
  },
});

/**
 * Generate a Convex Storage upload URL for attachment fields.
 * Validates the signing token to ensure only legitimate recipients can upload.
 */
export const generateAttachmentUploadUrl = mutation({
  args: {
    signingToken: v.string(),
  },
  handler: async (ctx, args) => {
    const recipient = await findRecipientByToken(ctx, args.signingToken);
    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }
    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }
    return await ctx.storage.generateUploadUrl();
  },
});
