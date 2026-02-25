import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const organizationTypeTuple = v.union(
  v.literal("personal"),
  v.literal("group"),
  v.literal("company"),
);
export type OrganizationType = Infer<typeof organizationTypeTuple>;

export const organizationStatus = v.union(
  v.literal("active"),
  v.literal("suspended"),
  v.literal("deleted"),
);
export type OrganizationStatus = Infer<typeof organizationStatus>;

export const organizationsTable = defineTable({
  name: v.string(),
  slug: v.string(),
  type: organizationTypeTuple,
  logo: v.optional(v.string()),
  metadata: v.optional(v.string()),
  currency: v.optional(v.string()), // default "BRL"
  currencyKind: v.optional(v.string()), // default "normal"
  timezone: v.string(), // default "UTC"
  isActive: v.boolean(),
  clerkId: v.optional(v.string()),

  // Organization status for permission checks
  status: v.optional(organizationStatus), // Optional for backward compatibility

  // AI workspace settings — all users in the org follow these
  aiSettings: v.optional(
    v.object({
      aiEnabled: v.boolean(), // Master switch for all AI features
      aiAutoAnalyze: v.boolean(), // Auto-run AI pipeline on document upload
      aiShowRedlinesToSigners: v.boolean(), // Show annotations to recipients on signing page
    }),
  ),

  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_type", ["type"])
  .index("by_active", ["isActive"])
  .index("by_clerk_id", ["clerkId"])
  .index("by_status", ["status"]);
