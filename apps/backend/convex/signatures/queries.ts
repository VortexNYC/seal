import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
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
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

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
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .collect();

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
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document_recipient", (q) =>
        q.eq("documentId", args.documentId).eq("recipientId", args.recipientId),
      )
      .collect();

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
    const signature = await ctx.db.get(args.signatureId);
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
    args,
  ): Promise<{
    signature: Doc<"signatures">;
    field: Doc<"signature_fields"> | null;
    recipient: Doc<"document_recipients"> | null;
  } | null> => {
    const signature = await ctx.db.get(args.signatureId);
    if (!signature) {
      return null;
    }

    const field = await ctx.db.get(signature.fieldId);
    const recipient = await ctx.db.get(signature.recipientId);

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
    args,
  ): Promise<
    Array<{
      signature: Doc<"signatures">;
      field: Doc<"signature_fields"> | null;
      recipient: Doc<"document_recipients"> | null;
    }>
  > => {
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const signatureDetails = await Promise.all(
      signatures.map(async (signature) => {
        const field = await ctx.db.get(signature.fieldId);
        const recipient = await ctx.db.get(signature.recipientId);

        return {
          signature,
          field,
          recipient,
        };
      }),
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
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return signatures.length;
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
    return await ctx.db
      .query("signatures")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});
