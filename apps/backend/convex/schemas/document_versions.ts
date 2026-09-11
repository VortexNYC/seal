import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const documentVersionChangeTypeTuple = v.union(
  v.literal("created"),
  v.literal("replaced"),
  v.literal("restored")
);
export type DocumentVersionChangeType = Infer<
  typeof documentVersionChangeTypeTuple
>;

export const documentVersionsTable = defineTable({
  documentId: v.id("documents"),
  versionNumber: v.number(),

  // Snapshot of document state at this version
  snapshot: v.object({
    name: v.string(),
    description: v.optional(v.string()),
    storageId: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    pageCount: v.optional(v.number()),
    documentHash: v.optional(v.string()),
  }),

  // Version metadata
  changeType: documentVersionChangeTypeTuple,
  changeDescription: v.optional(v.string()),
  restoredFromVersion: v.optional(v.number()),

  // Tracking
  betterAuthCreatedBy: v.optional(v.string()),
  createdBy: v.id("users"),
  createdAt: v.number(),
})
  .index("by_document", ["documentId", "versionNumber"])
  .index("by_better_auth_creator", ["betterAuthCreatedBy"])
  .index("by_document_latest", ["documentId", "createdAt"]);
