import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const documentPermissionLevelTuple = v.union(
  v.literal("view"), // Read-only access
  v.literal("edit"), // Can modify document
  v.literal("manage") // Can share, transfer ownership, delete
);
export type DocumentPermissionLevel = Infer<
  typeof documentPermissionLevelTuple
>;

export const documentAccessTable = defineTable({
  // References
  documentId: v.id("documents"),
  betterAuthUserId: v.optional(v.string()),
  userId: v.id("users"),

  // Permission level for this specific user
  permissionLevel: documentPermissionLevelTuple,

  // Audit trail - initial grant
  betterAuthGrantedBy: v.optional(v.string()),
  grantedBy: v.id("users"),
  grantedAt: v.number(),

  // Audit trail - permission updates
  betterAuthUpdatedBy: v.optional(v.string()),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.optional(v.number()),

  // Audit trail - revocation
  revokedAt: v.optional(v.number()),
  betterAuthRevokedBy: v.optional(v.string()),
  revokedBy: v.optional(v.id("users")),
})
  .index("by_document", ["documentId"])
  .index("by_user", ["userId"])
  .index("by_better_auth_user", ["betterAuthUserId"])
  .index("by_document_user", ["documentId", "userId"])
  .index("by_document_better_auth_user", ["documentId", "betterAuthUserId"]);
