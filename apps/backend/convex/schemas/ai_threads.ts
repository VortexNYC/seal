import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiThreadsTable = defineTable({
  threadId: v.string(),
  documentId: v.optional(v.id("documents")),
  vortexAuthOrganizationId: v.optional(v.string()),
  vortexAuthUserId: v.optional(v.string()),
  organizationId: v.id("organizations"),
  userId: v.string(),
  /** Thread type: "document" for document-specific, "search" for cross-document search */
  threadType: v.optional(v.union(v.literal("document"), v.literal("search"))),
  createdAt: v.number(),
})
  .index("by_thread_id", ["threadId"])
  .index("by_document", ["documentId"])
  .index("by_organization_user", ["organizationId", "userId"])
  .index("by_vortex_auth_organization_user", [
    "vortexAuthOrganizationId",
    "vortexAuthUserId",
  ]);
