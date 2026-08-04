import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiProgressTable = defineTable({
  threadId: v.string(),
  step: v.number(),
  totalSteps: v.optional(v.number()),
  completedTools: v.array(v.string()),
  tokensUsed: v.number(),
  status: v.union(
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("aborted"),
    v.literal("failed")
  ),
  error: v.optional(v.string()),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
}).index("by_thread_id", ["threadId"]);
