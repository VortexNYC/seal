import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { paymentExtractionValidator } from "../schemas/ai_field_suggestions";

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

/**
 * Store AI-extracted payment terms on a suggestion row.
 * Called by the pipeline after payment extraction completes.
 */
export const savePaymentExtractionOnSuggestion = internalMutation({
  args: {
    suggestionId: v.id("ai_field_suggestions"),
    paymentExtraction: paymentExtractionValidator,
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) throw new Error("Suggestion not found");
    if (suggestion.status !== "pending") return; // already applied/dismissed

    await ctx.db.patch(args.suggestionId, {
      paymentExtraction: args.paymentExtraction,
    });
  },
});
