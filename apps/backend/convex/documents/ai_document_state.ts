/**
 * AI-owned document state mutations.
 *
 * These are the remaining Convex document state writes that the AI
 * pipeline still uses. They live here so that the legacy
 * documents/mutations.ts barrel can be deleted.
 */

import { ConvexError, v } from "convex/values";

import { internalMutation } from "../_generated/server";

/**
 * Internal mutation to update the document hash.
 * Called by hashDocument action.
 *
 * SEA-108: Digital Signature Implementation
 */
export const updateDocumentHash = internalMutation({
  args: {
    documentId: v.id("documents"),
    documentHash: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const document = await ctx.db.get("documents", args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    await ctx.db.patch("documents", args.documentId, {
      documentHash: args.documentHash,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to store extracted text from PDF.
 * Called by extractText action.
 */
export const updateExtractedText = internalMutation({
  args: {
    documentId: v.id("documents"),
    extractedText: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const document = await ctx.db.get("documents", args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    await ctx.db.patch("documents", args.documentId, {
      extractedText: args.extractedText,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
