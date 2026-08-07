import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
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
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      fields.push(field);
    }

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
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_recipient", (q) =>
        q.eq("recipientId", args.recipientId)
      )) {
      fields.push(field);
    }

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
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document_page", (q) =>
        q.eq("documentId", args.documentId).eq("page", args.page)
      )) {
      fields.push(field);
    }

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
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", args.documentId).eq("recipientId", args.recipientId)
      )) {
      fields.push(field);
    }

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
    const field = await ctx.db.get("signature_fields", args.fieldId);
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
    args
  ): Promise<{
    field: Doc<"signature_fields">;
    recipient: Doc<"document_recipients"> | null;
  } | null> => {
    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      return null;
    }

    const recipient = field.recipientId
      ? await ctx.db.get("document_recipients", field.recipientId)
      : null;

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
    let count = 0;
    for await (const _field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      count++;
    }

    return count;
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
    args
  ): Promise<{
    total: number;
    required: number;
    optional: number;
    byType: Record<string, number>;
  }> => {
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      fields.push(field);
    }

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
    args
  ): Promise<{
    complete: boolean;
    totalRequired: number;
    completedRequired: number;
    missingFields: Doc<"signature_fields">[];
  }> => {
    // Get all required fields for the document
    const allFields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      allFields.push(field);
    }

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

type FieldWithValues = Doc<"signature_fields"> & {
  currentValue: string | undefined;
  currentSignatureImageUrl: string | undefined;
  isFilled: boolean;
  signatureDetails:
    | {
        signedAt: number;
        signerName: string | undefined;
        signerEmail: string | undefined;
        signatureMethod: string | undefined;
      }
    | undefined;
};

async function buildFieldWithValues(
  field: Doc<"signature_fields">,
  signature: Doc<"signatures"> | null,
  signerName: string | undefined,
  signerEmail: string | undefined,
  isPaymentPaid: boolean,
  encKey: string | undefined
): Promise<FieldWithValues> {
  const decryptedImageUrl = await decryptSignatureData(
    signature?.signatureImageUrl,
    encKey
  );

  return Object.assign({}, field, {
    currentValue: signature?.value,
    currentSignatureImageUrl: decryptedImageUrl,
    isFilled: !!signature || isPaymentPaid,
    signatureDetails: signature
      ? {
          signedAt: signature.signedAt,
          signerName,
          signerEmail,
          signatureMethod: signature.signatureMethod,
        }
      : undefined,
  });
}

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
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q
          .eq("documentId", recipient.documentId)
          .eq("recipientId", recipient._id)
      )) {
      fields.push(field);
    }

    const encKey = process.env.SIGNATURE_ENCRYPTION_KEY;
    const fieldsWithValues: FieldWithValues[] = [];
    for (const field of fields) {
      const signature = await ctx.db
        .query("signatures")
        .withIndex("by_field", (q) => q.eq("fieldId", field._id))
        .first();

      let signerName: string | undefined;
      let signerEmail: string | undefined;
      if (signature) {
        const signerRecipient = await ctx.db.get(
          "document_recipients",
          signature.recipientId
        );
        if (signerRecipient) {
          signerEmail = signerRecipient.email;
          if (signerRecipient.name) {
            signerName = signerRecipient.name;
          } else {
            const signerUser = await ctx.db
              .query("users")
              .withIndex("by_email", (q) =>
                q.eq("email", signerRecipient.email)
              )
              .first();
            signerName = signerUser?.name ?? undefined;
          }
        }
      }

      let isPaymentPaid = false;
      if (field.fieldType === "payment") {
        const paymentConfig = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .first();
        isPaymentPaid = paymentConfig?.paymentStatus === "paid";
      }

      fieldsWithValues.push(
        await buildFieldWithValues(
          field,
          signature,
          signerName,
          signerEmail,
          isPaymentPaid,
          encKey
        )
      );
    }
    return fieldsWithValues.toSorted((a, b) => a.page - b.page);
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
    const user = await ctx.db.get("users", userId);
    if (!user || !user.email) {
      return [];
    }

    const userEmail = user.email.toLowerCase();

    // 2. Find recipient by document + email match
    let recipient: Doc<"document_recipients"> | null = null;
    for await (const candidate of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      if (candidate.email === userEmail) {
        recipient = candidate;
        break;
      }
    }

    if (!recipient) {
      return [];
    }

    // 3. Get all fields assigned to this recipient
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", args.documentId).eq("recipientId", recipient._id)
      )) {
      fields.push(field);
    }

    const encKey = process.env.SIGNATURE_ENCRYPTION_KEY;
    const fieldsWithValues: FieldWithValues[] = [];
    for (const field of fields) {
      const signature = await ctx.db
        .query("signatures")
        .withIndex("by_field", (q) => q.eq("fieldId", field._id))
        .first();

      let signerName: string | undefined;
      let signerEmail: string | undefined;
      if (signature) {
        const signerRecipient = await ctx.db.get(
          "document_recipients",
          signature.recipientId
        );
        if (signerRecipient) {
          signerEmail = signerRecipient.email;
          if (signerRecipient.name) {
            signerName = signerRecipient.name;
          } else {
            const signerUser = await ctx.db
              .query("users")
              .withIndex("by_email", (q) =>
                q.eq("email", signerRecipient.email)
              )
              .first();
            signerName = signerUser?.name ?? undefined;
          }
        }
      }

      let isPaymentPaid = false;
      if (field.fieldType === "payment") {
        const paymentConfig = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .first();
        isPaymentPaid = paymentConfig?.paymentStatus === "paid";
      }

      fieldsWithValues.push(
        await buildFieldWithValues(
          field,
          signature,
          signerName,
          signerEmail,
          isPaymentPaid,
          encKey
        )
      );
    }
    return fieldsWithValues.toSorted((a, b) => a.page - b.page);
  },
});

/**
 * Internal query to get signature fields by document ID without access control
 * Used by actions that need to access signature fields
 */
export const getFieldsByDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      fields.push(field);
    }
    return fields;
  },
});
