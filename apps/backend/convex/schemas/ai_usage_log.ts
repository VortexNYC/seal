import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiActionValidator = v.union(
  v.literal("field_analysis"),
  v.literal("payment_extraction"),
  v.literal("redlining"),
  v.literal("search"),
  v.literal("chat"),
  v.literal("ocr_fallback")
);

export const aiUsageLogTable = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),
  action: aiActionValidator,
  tokensUsed: v.number(),
  estimatedCostUsd: v.number(),
  durationMs: v.number(),
  documentId: v.optional(v.id("documents")),
  modelUsed: v.string(),
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_created", ["organizationId", "createdAt"])
  .index("by_user", ["userId"]);
