import { v } from "convex/values";

import { authQuery } from "../auth/wrappers";

export const getFieldSuggestions = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_field_suggestions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .order("desc")
      .first();
  },
});

export const getDocumentAnnotations = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_document_annotations")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .first();
  },
});

export const getAIAnalysisStatus = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("ai_field_suggestions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();

    if (!latest) return { status: "none" as const };
    return {
      status: latest.status,
      fieldCount: latest.fields.length,
      modelUsed: latest.modelUsed,
      processingTimeMs: latest.processingTimeMs,
    };
  },
});
