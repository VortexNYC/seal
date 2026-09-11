import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const folderTypeTuple = v.union(
  v.literal("document"),
  v.literal("template")
);
export type FolderType = Infer<typeof folderTypeTuple>;

export const folderVisibilityTuple = v.union(
  v.literal("everyone"),
  v.literal("admin")
);
export type FolderVisibility = Infer<typeof folderVisibilityTuple>;

export const foldersTable = defineTable({
  vortexAuthOrganizationId: v.optional(v.string()),
  vortexAuthCreatedBy: v.optional(v.string()),
  organizationId: v.id("organizations"),
  name: v.string(),
  parentId: v.optional(v.id("folders")),
  type: folderTypeTuple,
  visibility: folderVisibilityTuple,
  pinned: v.optional(v.boolean()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_vortex_auth_organization", ["vortexAuthOrganizationId"])
  .index("by_parent", ["parentId"])
  .index("by_org_type", ["organizationId", "type"])
  .index("by_vortex_auth_org_type", ["vortexAuthOrganizationId", "type"])
  .index("by_org_created_by", ["organizationId", "createdBy"]);
