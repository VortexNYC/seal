import { ConvexError, v } from "convex/values";

import { getAuthContext, memberQuery } from "../auth";

type PaymentStatusFilter = "paid" | "open" | "void" | "all";

function assertActiveOrganization(auth: Awaited<ReturnType<typeof getAuthContext>>, slug: string) {
  if (auth.organization.slug !== slug) {
    throw new ConvexError("Organization mismatch");
  }

  return auth.organization._id;
}

export const getRevenueStats = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = assertActiveOrganization(ctx.auth, args.slug);

    // convex-cost-guard-allow: convex-broad-organization-collect — revenue stats require scanning all invoices for the org to compute accurate totals bound=per-tenant
    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let monthlyRevenue = 0;

    for (const invoice of invoices) {
      if (invoice.status === "paid") {
        totalRevenue += invoice.amountDue;
        paidCount += 1;

        if (invoice.paidAt !== undefined && invoice.paidAt >= thirtyDaysAgo) {
          monthlyRevenue += invoice.amountDue;
        }
      } else if (invoice.status === "open") {
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

export const getTransactionList = memberQuery({
  args: {
    slug: v.string(),
    statusFilter: v.optional(
      v.union(v.literal("paid"), v.literal("open"), v.literal("void"), v.literal("all")),
    ),
  },
  handler: async (ctx, args) => {
    const organizationId = assertActiveOrganization(ctx.auth, args.slug);

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    const statusFilter = args.statusFilter satisfies PaymentStatusFilter | undefined;
    const filtered =
      statusFilter !== undefined && statusFilter !== "all"
        ? invoices.filter((invoice) => invoice.status === statusFilter)
        : invoices;

    return await Promise.all(
      filtered.map(async (invoice) => {
        const document = await ctx.db.get(invoice.documentId);

        return {
          _id: invoice._id,
          documentId: invoice.documentId,
          documentTitle: document?.name ?? "Untitled Document",
          customerEmail: invoice.customerEmail,
          customerName: invoice.customerName,
          amountDue: invoice.amountDue,
          currency: invoice.currency,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          invoicePdf: invoice.invoicePdf,
          paidAt: invoice.paidAt,
          createdAt: invoice.createdAt,
        };
      }),
    );
  },
});

export const getActiveSubscriptions = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = assertActiveOrganization(ctx.auth, args.slug);

    const configs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const recurring = configs.filter(
      (config) => config.paymentType === "recurring" && config.providerSubscriptionId !== undefined,
    );

    return await Promise.all(
      recurring.map(async (config) => {
        const processorSubscriptionId = config.providerSubscriptionId;
        if (processorSubscriptionId === undefined) {
          throw new ConvexError("Recurring payment is missing processor subscription id");
        }

        const document = await ctx.db.get(config.documentId);

        const invoice =
          config.providerInvoiceId === undefined
            ? null
            : await ctx.db
                .query("document_invoices")
                .withIndex("by_provider_invoice", (q) =>
                  q.eq("providerInvoiceId", config.providerInvoiceId),
                )
                .first();

        return {
          _id: config._id,
          documentId: config.documentId,
          documentTitle: document?.name ?? "Untitled Document",
          customerEmail: invoice?.customerEmail ?? "Unknown",
          customerName: invoice?.customerName,
          amountCents: config.totalAmountCents,
          currency: config.currency,
          interval: config.recurringConfig?.interval ?? "month",
          intervalCount: config.recurringConfig?.intervalCount ?? 1,
          endCondition: config.recurringConfig?.endCondition ?? "never",
          paymentStatus: config.paymentStatus ?? "pending",
          processorSubscriptionId,
          createdAt: config.createdAt,
        };
      }),
    );
  },
});
