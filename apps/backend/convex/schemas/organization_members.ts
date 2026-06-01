import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

import { userStatus } from "./users";

export const organizationMemberRoleTuple = v.union(
  v.literal("system"),
  v.literal("admin"),
  v.literal("owner"),
  v.literal("member"),
  v.literal("viewer"),
);
export type OrganizationMemberRole = Infer<typeof organizationMemberRoleTuple>;

export const organizationMemberStatus = userStatus;
export type OrganizationMemberStatus = Infer<typeof organizationMemberStatus>;

export const organizationMembersTable = defineTable({
  userId: v.id("users"),
  organizationId: v.id("organizations"),

  role: organizationMemberRoleTuple,
  permissions: v.optional(v.array(v.string())),

  // Custom role assignment (optional)
  roleId: v.optional(v.id("organization_roles")),

  // Fine-grained permission overrides
  permissionOverrides: v.optional(
    v.object({
      add: v.optional(v.array(v.string())), // Additional permissions
      remove: v.optional(v.array(v.string())), // Remove specific permissions
    }),
  ),

  status: organizationMemberStatus,

  isPrimary: v.boolean(),
})
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_user_organization", ["userId", "organizationId"])
  .index("by_user_primary", ["userId", "isPrimary"])
  .index("by_organization_status", ["organizationId", "status"])
  .index("by_user_status", ["userId", "status"])
  .index("by_role", ["roleId"])
  .index("by_organization_role", ["organizationId", "role"]);
