import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiThreadsTable = defineTable({
  threadId: v.string(),
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  userId: v.string(),
  createdAt: v.number(),
})
  .index("by_thread_id", ["threadId"])
  .index("by_document", ["documentId"])
  .index("by_organization_user", ["organizationId", "userId"]);
