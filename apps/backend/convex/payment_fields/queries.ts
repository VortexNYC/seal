import { v } from "convex/values";

import { internalQuery, query } from "../_generated/server";

/**
 * Payment Field Config Queries
 *
 * Read-only queries for payment field configurations.
 */

/**
 * Get payment config for a specific field.
 */
export const getPaymentConfigByField = query({
  args: {
    fieldId: v.id("signature_fields"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_field_configs")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .unique();
  },
});

/**
 * Get all payment configs for a document.
 */
export const getPaymentConfigsByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_field_configs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

/**
 * Internal query for payment configs by document (used by actions).
 */
export const getPaymentConfigsByDocumentInternal = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_field_configs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});
