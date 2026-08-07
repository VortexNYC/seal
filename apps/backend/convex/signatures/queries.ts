import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
import { decryptSignatureData } from "../crypto/encryption";
import { checkRecipientComplete, getDocumentCompletionStatus } from "./helpers";

/**
 * Signature Queries
 *
 * Retrieve signatures by document, recipient, field, or ID.
 *
 * SEA-31: Database Schemas - Signatures Query Operations
 */

/**
 * Get all signatures for a specific document
 */
export const getSignaturesByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<Doc<"signatures">[]> => {
    const signatures: Doc<"signatures">[] = [];
    for await (const signature of ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      signatures.push(signature);
    }

    return signatures;
  },
});

/**
 * Get all signatures created by a specific recipient
 */
export const getSignaturesByRecipient = query({
  args: {
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args): Promise<Doc<"signatures">[]> => {
    const signatures: Doc<"signatures">[] = [];
    for await (const signature of ctx.db
      .query("signatures")
      .withIndex("by_recipient", (q) =>
        q.eq("recipientId", args.recipientId)
      )) {
      signatures.push(signature);
    }

    return signatures;
  },
});

/**
 * Get signature for a specific field
 */
export const getSignatureByField = query({
  args: {
    fieldId: v.id("signature_fields"),
  },
  handler: async (ctx, args): Promise<Doc<"signatures"> | null> => {
    const signature = await ctx.db
      .query("signatures")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .first();

    return signature;
  },
});

/**
 * Get signatures for a document by a specific recipient
 */
export const getSignaturesByDocumentAndRecipient = query({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args): Promise<Doc<"signatures">[]> => {
    const signatures: Doc<"signatures">[] = [];
    for await (const signature of ctx.db
      .query("signatures")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", args.documentId).eq("recipientId", args.recipientId)
      )) {
      signatures.push(signature);
    }

    return signatures;
  },
});

/**
 * Get a single signature by ID
 */
export const getSignatureById = query({
  args: {
    signatureId: v.id("signatures"),
  },
  handler: async (ctx, args): Promise<Doc<"signatures"> | null> => {
    const signature = await ctx.db.get("signatures", args.signatureId);
    return signature;
  },
});

/**
 * Get signature with field and recipient details
 */
export const getSignatureWithDetails = query({
  args: {
    signatureId: v.id("signatures"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    signature: Doc<"signatures">;
    field: Doc<"signature_fields"> | null;
    recipient: Doc<"document_recipients"> | null;
  } | null> => {
    const signature = await ctx.db.get("signatures", args.signatureId);
    if (!signature) {
      return null;
    }

    const field = await ctx.db.get("signature_fields", signature.fieldId);
    const recipient = await ctx.db.get(
      "document_recipients",
      signature.recipientId
    );

    return {
      signature,
      field,
      recipient,
    };
  },
});

/**
 * Get document completion status
 * Returns completion percentage and list of incomplete required fields
 */
export const getDocumentCompletion = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return await getDocumentCompletionStatus(ctx, args.documentId);
  },
});

/**
 * Check if recipient has completed all their fields
 */
export const getRecipientCompletion = query({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    return await checkRecipientComplete(ctx, args.documentId, args.recipientId);
  },
});

/**
 * Get all signatures with field information for a document
 * Useful for displaying signature details in the UI
 */
export const getDocumentSignaturesWithFields = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      signature: Doc<"signatures">;
      field: Doc<"signature_fields"> | null;
      recipient: Doc<"document_recipients"> | null;
    }>
  > => {
    const signatures: Doc<"signatures">[] = [];
    for await (const signature of ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      signatures.push(signature);
    }

    const signatureDetails = await Promise.all(
      signatures.map(async (signature) => {
        const field = await ctx.db.get("signature_fields", signature.fieldId);
        const recipient = await ctx.db.get(
          "document_recipients",
          signature.recipientId
        );

        return {
          signature,
          field,
          recipient,
        };
      })
    );

    return signatureDetails;
  },
});

/**
 * Get count of signatures by document
 */
export const getSignatureCountByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<number> => {
    let count = 0;
    for await (const _signature of ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      count++;
    }

    return count;
  },
});

/**
 * Internal query to get signatures by document ID without access control
 * Used by actions that need to access signatures
 *
 * SEA-108: Digital Signature Implementation
 */
export const getSignaturesByDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const signatures: Doc<"signatures">[] = [];
    for await (const signature of ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      signatures.push(signature);
    }
    return signatures;
  },
});

/**
 * Internal query to get signatures with decrypted image data.
 * Used by the PDF signing action which needs the raw image data to embed.
 */
export const getDecryptedSignaturesByDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const signatures: Doc<"signatures">[] = [];
    for await (const signature of ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      signatures.push(signature);
    }

    const encKey = process.env.SIGNATURE_ENCRYPTION_KEY;

    return Promise.all(
      signatures.map(async (sig) => {
        const signatureImageUrl = await decryptSignatureData(
          sig.signatureImageUrl,
          encKey
        );
        return Object.assign({}, sig, { signatureImageUrl });
      })
    );
  },
});
