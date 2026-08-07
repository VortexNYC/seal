import { ConvexError, v } from "convex/values";

import { getAuthContext, memberQuery } from "../auth";

type PaymentStatusFilter = "paid" | "open" | "void" | "all";

function assertActiveOrganization(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  slug: string
) {
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

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let monthlyRevenue = 0;
    let currency = "usd";

    for await (const invoice of ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (invoice.status === "paid") {
        totalRevenue += invoice.amountDue;
        paidCount += 1;

        if (invoice.paidAt !== undefined && invoice.paidAt >= thirtyDaysAgo) {
          monthlyRevenue += invoice.amountDue;
        }
      } else if (invoice.status === "open") {
        pendingCount += 1;
      }
      currency = invoice.currency;
    }

    return {
      totalRevenue,
      paidCount,
      pendingCount,
      monthlyRevenue,
      currency,
    };
  },
});

export const getTransactionList = memberQuery({
  args: {
    slug: v.string(),
    statusFilter: v.optional(
      v.union(
        v.literal("paid"),
        v.literal("open"),
        v.literal("void"),
        v.literal("all")
      )
    ),
  },
  handler: async (ctx, args) => {
    const organizationId = assertActiveOrganization(ctx.auth, args.slug);

    const statusFilter = args.statusFilter satisfies
      | PaymentStatusFilter
      | undefined;

    const results = [];
    for await (const invoice of ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )
      .order("desc")) {
      if (
        statusFilter !== undefined &&
        statusFilter !== "all" &&
        invoice.status !== statusFilter
      ) {
        continue;
      }

      const document = await ctx.db.get("documents", invoice.documentId);

      results.push({
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
      });
    }

    return results;
  },
});

export const getActiveSubscriptions = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = assertActiveOrganization(ctx.auth, args.slug);

    const recurring = [];
    for await (const config of ctx.db
      .query("payment_field_configs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (
        config.paymentType === "recurring" &&
        config.providerSubscriptionId !== undefined
      ) {
        recurring.push(config);
      }
    }

    return await Promise.all(
      recurring.map(async (config) => {
        const processorSubscriptionId = config.providerSubscriptionId;
        if (processorSubscriptionId === undefined) {
          throw new ConvexError(
            "Recurring payment is missing processor subscription id"
          );
        }

        const document = await ctx.db.get("documents", config.documentId);

        const invoice =
          config.providerInvoiceId === undefined
            ? null
            : await ctx.db
                .query("document_invoices")
                .withIndex("by_provider_invoice", (q) =>
                  q.eq("providerInvoiceId", config.providerInvoiceId)
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
      })
    );
  },
});
