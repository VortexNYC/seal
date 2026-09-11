import { defineTable } from "convex/server";
import { v } from "convex/values";

export const annotationCategoryTuple = v.union(
  v.literal("obligation"),
  v.literal("payment"),
  v.literal("risk"),
  v.literal("dates"),
  v.literal("terms")
);

export const annotationSeverityTuple = v.union(
  v.literal("informational"),
  v.literal("important"),
  v.literal("critical")
);

export type AnnotationCategory =
  | "obligation"
  | "payment"
  | "risk"
  | "dates"
  | "terms";
export type AnnotationSeverity = "informational" | "important" | "critical";

export const aiDocumentAnnotationsTable = defineTable({
  documentId: v.id("documents"),
  vortexAuthOrganizationId: v.optional(v.string()),
  organizationId: v.id("organizations"),
  annotations: v.array(
    v.object({
      page: v.number(),
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
      category: annotationCategoryTuple,
      severity: annotationSeverityTuple,
      text: v.string(),
      summary: v.string(),
    })
  ),
  modelUsed: v.string(),
  tokensUsed: v.number(),
  processingTimeMs: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("active"),
    v.literal("dismissed")
  ),
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_document_status", ["documentId", "status"])
  .index("by_organization", ["organizationId"]);
