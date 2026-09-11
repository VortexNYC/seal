import { defineTable } from "convex/server";
import { v } from "convex/values";

export const dataExportsTable = defineTable({
  vortexAuthUserId: v.optional(v.string()),
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
  .index("by_vortex_auth_user", ["vortexAuthUserId"])
  .index("by_user", ["userId"]);
