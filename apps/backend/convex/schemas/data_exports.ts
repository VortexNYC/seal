import { defineTable } from "convex/server";
import { v } from "convex/values";

export const dataExportsTable = defineTable({
  betterAuthUserId: v.optional(v.string()),
  userId: v.id("users"),
  status: v.union(
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  storageId: v.optional(v.string()),
  error: v.optional(v.string()),
  requestedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_better_auth_user", ["betterAuthUserId"])
  .index("by_user", ["userId"]);
