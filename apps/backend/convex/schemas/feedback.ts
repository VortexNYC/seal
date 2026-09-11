import { defineTable } from "convex/server";
import { v } from "convex/values";

export const feedbackTypeTuple = v.union(
  v.literal("bug"),
  v.literal("suggestion")
);

export const feedbackTable = defineTable({
  betterAuthUserId: v.optional(v.string()),
  betterAuthOrganizationId: v.optional(v.string()),
  userId: v.id("users"),
  organizationId: v.id("organizations"),
  type: feedbackTypeTuple,
  message: v.string(),
  route: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_better_auth_organization", ["betterAuthOrganizationId"])
  .index("by_user", ["userId"])
  .index("by_better_auth_user", ["betterAuthUserId"]);
