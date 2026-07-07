/**
 * Labels schema
 *
 * Labels for categorizing and tagging resources within an organization.
 */

import { defineTable } from "convex/server";
import { v } from "convex/values";

export const labelsTable = defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  color: v.optional(v.string()),
  description: v.optional(v.string()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_name", ["organizationId", "name"]);
