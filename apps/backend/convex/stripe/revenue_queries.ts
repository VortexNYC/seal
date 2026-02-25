import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";

/**
 * Get aggregate revenue statistics for the organization.
 * Reads from document_invoices table, scoped by organizationId.
 */
export const getRevenueStats = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let monthlyRevenue = 0;

    for (const inv of invoices) {
      if (inv.status === "paid") {
        totalRevenue += inv.amountDue;
        paidCount += 1;
        if (inv.paidAt && inv.paidAt >= thirtyDaysAgo) {
          monthlyRevenue += inv.amountDue;
        }
      } else if (inv.status === "open") {
        pendingCount += 1;
      }
    }

    return {
      totalRevenue,
      paidCount,
      pendingCount,
      monthlyRevenue,
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Get list of transactions (invoices) for the organization.
 * Joins with documents table to include document title.
 */
export const getTransactionList = memberQuery({
  args: {
    slug: v.string(),
    statusFilter: v.optional(
      v.union(v.literal("paid"), v.literal("open"), v.literal("void"), v.literal("all")),
    ),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .collect();

    const filtered =
      args.statusFilter && args.statusFilter !== "all"
        ? invoices.filter((inv) => inv.status === args.statusFilter)
        : invoices;

    const transactions = await Promise.all(
      filtered.map(async (inv) => {
        const document = await ctx.db.get(inv.documentId);
        return {
          _id: inv._id,
          documentId: inv.documentId,
          documentTitle: document?.name ?? "Untitled Document",
          customerEmail: inv.customerEmail,
          customerName: inv.customerName,
          amountDue: inv.amountDue,
          currency: inv.currency,
          status: inv.status,
          hostedInvoiceUrl: inv.hostedInvoiceUrl,
          invoicePdf: inv.invoicePdf,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
        };
      }),
    );

    return transactions;
  },
});
