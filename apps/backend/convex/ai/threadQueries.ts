import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

/**
 * Internal query to get thread mapping by document ID.
 * Used by actions that can't go through auth wrappers.
 */
export const getThreadByDocument = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_threads")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();
  },
});
