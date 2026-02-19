import { defineTable } from "convex/server";
import { v } from "convex/values";

import { fieldTypeTuple } from "./signature_fields";

export const aiFieldSuggestionsTable = defineTable({
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  fields: v.array(
    v.object({
      fieldType: fieldTypeTuple,
      page: v.number(),
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
      label: v.string(),
      confidence: v.number(),
      isRequired: v.boolean(),
    }),
  ),
  modelUsed: v.string(),
  tokensUsed: v.number(),
  processingTimeMs: v.number(),
  status: v.union(v.literal("pending"), v.literal("applied"), v.literal("dismissed")),
})
  .index("by_document", ["documentId"])
  .index("by_organization", ["organizationId"]);
