import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const documentPermissionLevelTuple = v.union(
	v.literal("view"), // Read-only access
	v.literal("edit"), // Can modify document
	v.literal("manage"), // Can share, transfer ownership, delete
);
export type DocumentPermissionLevel = Infer<
	typeof documentPermissionLevelTuple
>;

export const documentAccessTable = defineTable({
	// References
	documentId: v.id("documents"),
	userId: v.id("users"),

	// Permission level for this specific user
	permissionLevel: documentPermissionLevelTuple,

	// Audit trail
	grantedBy: v.id("users"), // Who granted this access
	grantedAt: v.number(),
	revokedAt: v.optional(v.number()), // If access was revoked
})
	.index("by_document", ["documentId"])
	.index("by_user", ["userId"])
	.index("by_document_user", ["documentId", "userId"]);
