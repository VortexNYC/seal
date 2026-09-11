import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

/**
 * Internal query to get signature fields by document ID without access control.
 * Used by actions that need to access signature fields.
 */
export const getFieldsByDocumentInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const fields = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      fields.push(field);
    }
    return fields;
  },
});
