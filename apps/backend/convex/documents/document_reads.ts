/**
 * Minimal internal document read helpers.
 */

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

/**
 * Internal query to get a document by ID without access control.
 * Used by actions and the AI pipeline that need to access documents.
 */
export const getDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }
    return document;
  },
});
