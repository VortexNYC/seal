import { v } from "convex/values";

import { authQuery } from "../auth/wrappers";

/**
 * Public query to get the active invoice for a document.
 * Returns the most recent non-deleted/void invoice, or null if none exists.
 */
export const getInvoiceByDocument = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    // Verify user has access to the document through organization
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    // RLS will filter access, but we also verify org membership
    if (document.organizationId !== ctx.auth.organization._id) {
      return null;
    }

    // Query document_invoices by documentId, excluding deleted/void statuses
    const invoice = await ctx.db
      .query("document_invoices")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.and(q.neq(q.field("status"), "deleted"), q.neq(q.field("status"), "void")))
      .order("desc")
      .first();

    return invoice;
  },
});
