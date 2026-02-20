import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

export const setAiProcessingStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      aiProcessingStatus: args.status,
      updatedAt: Date.now(),
    });
  },
});
