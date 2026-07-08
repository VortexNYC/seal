import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";

/**
 * Get all active recurring payment configs for the organization.
 * Joins with documents for context.
 */
export const getActiveSubscriptions = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const configs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const recurring = configs.filter(
      (c) => c.paymentType === "recurring" && c.providerSubscriptionId,
    );

    const subscriptions = await Promise.all(
      recurring.map(async (config) => {
        const document = await ctx.db.get(config.documentId);

        const providerInvoiceId = config.providerInvoiceId;
        const providerSubscriptionId = config.providerSubscriptionId;
        if (!providerSubscriptionId) return null;

        const invoice = providerInvoiceId
          ? await ctx.db
              .query("document_invoices")
              .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", providerInvoiceId))
              .first()
          : null;

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
          providerSubscriptionId,
          createdAt: config.createdAt,
        };
      }),
    );

    return subscriptions.filter((subscription) => subscription !== null);
  },
});
