import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { authQuery } from "../auth";
import { decryptSignatureData } from "../crypto/encryption";
import { findRecipientByToken } from "../documents/recipient_helpers";

/**
 * Signature Field Queries
 *
 * Retrieve signature fields by document, recipient, page, or ID.
 *
 * SEA-31: Database Schemas - Signature Fields Query Operations
 */

/**
 * Get all fields for a specific document
 */
export const getFieldsByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return fields;
  },
});

/**
 * Get all fields assigned to a specific recipient
 */
export const getFieldsByRecipient = query({
  args: {
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .collect();

    return fields;
  },
});

/**
 * Get all fields on a specific page of a document
 */
export const getFieldsByPage = query({
  args: {
    documentId: v.id("documents"),
    page: v.number(),
  },
  handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document_page", (q) =>
        q.eq("documentId", args.documentId).eq("page", args.page),
      )
      .collect();

    return fields;
  },
});

/**
 * Get all fields for a document assigned to a specific recipient
 */
export const getFieldsByDocumentAndRecipient = query({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", args.documentId).eq("recipientId", args.recipientId),
      )
      .collect();

    return fields;
  },
});

/**
 * Get a single field by ID
 */
export const getFieldById = query({
  args: {
    fieldId: v.id("signature_fields"),
  },
  handler: async (ctx, args): Promise<Doc<"signature_fields"> | null> => {
    const field = await ctx.db.get(args.fieldId);
    return field;
  },
});

/**
 * Get field with recipient details
 */
export const getFieldWithRecipient = query({
  args: {
    fieldId: v.id("signature_fields"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    field: Doc<"signature_fields">;
    recipient: Doc<"document_recipients"> | null;
  } | null> => {
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      return null;
    }

    const recipient = await ctx.db.get(field.recipientId);

    return {
      field,
      recipient,
    };
  },
});

/**
 * Get count of fields by document
 */
export const getFieldCountByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<number> => {
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return fields.length;
  },
});

/**
 * Get count of required vs optional fields for a document
 */
export const getFieldStatsByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    total: number;
    required: number;
    optional: number;
    byType: Record<string, number>;
  }> => {
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const required = fields.filter((f) => f.isRequired).length;
    const optional = fields.length - required;

    // Count by field type
    const byType: Record<string, number> = {};
    for (const field of fields) {
      byType[field.fieldType] = (byType[field.fieldType] || 0) + 1;
    }

    return {
      total: fields.length,
      required,
      optional,
      byType,
    };
  },
});

/**
 * Check if all required fields have been filled (have signatures)
 */
export const checkRequiredFieldsComplete = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    complete: boolean;
    totalRequired: number;
    completedRequired: number;
    missingFields: Doc<"signature_fields">[];
  }> => {
    // Get all required fields for the document
    const allFields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const requiredFields = allFields.filter((f) => f.isRequired);

    // Check which required fields have signatures
    const missingFields: Doc<"signature_fields">[] = [];

    for (const field of requiredFields) {
      const signature = await ctx.db
        .query("signatures")
        .withIndex("by_field", (q) => q.eq("fieldId", field._id))
        .first();

      if (!signature) {
        missingFields.push(field);
      }
    }

    const completedRequired = requiredFields.length - missingFields.length;

    return {
      complete: missingFields.length === 0,
      totalRequired: requiredFields.length,
      completedRequired,
      missingFields,
    };
  },
});

/**
 * Get all fields assigned to a recipient by signing token
 * Returns fields with their current values from signatures table
 * Used on the signing page to display fillable fields
 */
export const getFieldsBySigningToken = query({
  args: {
    signingToken: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find recipient by token (hash-based lookup with plaintext fallback)
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new Error("Invalid signing token");
    }

    // 2. Get all fields assigned to this recipient
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", recipient.documentId).eq("recipientId", recipient._id),
      )
      .collect();

    // 3. Get existing signatures for these fields with full details
    const encKey = process.env.SIGNATURE_ENCRYPTION_KEY;
    const fieldsWithValues = await Promise.all(
      fields.map(async (field) => {
        const signature = await ctx.db
          .query("signatures")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .first();

        // Get recipient info for this signature if it exists
        let signerName: string | undefined;
        let signerEmail: string | undefined;

        if (signature) {
          const signerRecipient = await ctx.db.get(signature.recipientId);
          if (signerRecipient) {
            signerEmail = signerRecipient.email;
            // Try recipient name first, then look up user by email for their name
            if (signerRecipient.name) {
              signerName = signerRecipient.name;
            } else {
              // Try to get user's name from users table by email
              const signerUser = await ctx.db
                .query("users")
                .withIndex("by_email", (q) => q.eq("email", signerRecipient.email))
                .first();
              signerName = signerUser?.name ?? undefined;
            }
          }
        }

        // Decrypt signature image data for display
        const decryptedImageUrl = await decryptSignatureData(
          signature?.signatureImageUrl,
          encKey,
        );

        return {
          ...field,
          currentValue: signature?.value,
          currentSignatureImageUrl: decryptedImageUrl,
          isFilled: !!signature,
          // Include signature details for display
          signatureDetails: signature
            ? {
                signedAt: signature.signedAt,
                signerName,
                signerEmail,
                signatureMethod: signature.signatureMethod,
              }
            : undefined,
        };
      }),
    );

    // 4. Sort by page number for easier rendering
    fieldsWithValues.sort((a, b) => a.page - b.page);

    return fieldsWithValues;
  },
});

/**
 * Get all fields assigned to the current authenticated user for a document
 * Returns fields with their current values from signatures table
 * Used for in-app signing when the user is both authenticated and a recipient
 */
export const getFieldsForAuthenticatedRecipient = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get user email
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      return [];
    }

    const userEmail = user.email.toLowerCase();

    // 2. Find recipient by document + email match
    const recipient = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first();

    if (!recipient) {
      return [];
    }

    // 3. Get all fields assigned to this recipient
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", args.documentId).eq("recipientId", recipient._id),
      )
      .collect();

    // 4. Get existing signatures for these fields with full details
    const encKey = process.env.SIGNATURE_ENCRYPTION_KEY;
    const fieldsWithValues = await Promise.all(
      fields.map(async (field) => {
        const signature = await ctx.db
          .query("signatures")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .first();

        // Get recipient info for this signature if it exists
        let signerName: string | undefined;
        let signerEmail: string | undefined;

        if (signature) {
          const signerRecipient = await ctx.db.get(signature.recipientId);
          if (signerRecipient) {
            signerEmail = signerRecipient.email;
            // Try recipient name first, then look up user by email for their name
            if (signerRecipient.name) {
              signerName = signerRecipient.name;
            } else {
              // Try to get user's name from users table by email
              const signerUser = await ctx.db
                .query("users")
                .withIndex("by_email", (q) => q.eq("email", signerRecipient.email))
                .first();
              signerName = signerUser?.name ?? undefined;
            }
          }
        }

        // Decrypt signature image data for display
        const decryptedImageUrl = await decryptSignatureData(
          signature?.signatureImageUrl,
          encKey,
        );

        return {
          ...field,
          currentValue: signature?.value,
          currentSignatureImageUrl: decryptedImageUrl,
          isFilled: !!signature,
          // Include signature details for display
          signatureDetails: signature
            ? {
                signedAt: signature.signedAt,
                signerName,
                signerEmail,
                signatureMethod: signature.signatureMethod,
              }
            : undefined,
        };
      }),
    );

    // 5. Sort by page number for easier rendering
    fieldsWithValues.sort((a, b) => a.page - b.page);

    return fieldsWithValues;
  },
});

/**
 * Internal query to get signature fields by document ID without access control
 * Used by actions that need to access signature fields
 */
import { internalQuery } from "../_generated/server";

export const getFieldsByDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});
