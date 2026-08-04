import { defineTable } from "convex/server";
import { v } from "convex/values";

export const feedbackTypeTuple = v.union(
  v.literal("bug"),
  v.literal("suggestion")
);

export const feedbackTable = defineTable({
  userId: v.id("users"),
  organizationId: v.id("organizations"),
  type: feedbackTypeTuple,
  message: v.string(),
  route: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"]);
