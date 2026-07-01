import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Internal queries/mutations for Stripe Connect account persistence.
 * These are only called by actions and webhooks.
 */

export const getAccountByOrganizationId = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});

export const getAccountByStripeId = internalQuery({
  args: {
    stripeAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("stripe_accounts")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .first();
  },
});

export const upsertStripeAccount = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    provider: v.optional(v.union(v.literal("stripe"), v.literal("vortex"))),
    stripeAccountId: v.string(),
    vortexMerchantAccountId: v.optional(v.string()),
    accountType: v.union(v.literal("standard"), v.literal("express")),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
    requirements: v.optional(
      v.object({
        currentlyDue: v.array(v.string()),
        eventuallyDue: v.array(v.string()),
        pastDue: v.array(v.string()),
        disabledReason: v.optional(v.string()),
      }),
    ),
    capabilities: v.optional(
      v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      }),
    ),
    feeHandling: v.optional(v.union(v.literal("absorb"), v.literal("pass_to_recipient"))),
    defaultCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Upsert by Stripe account id to avoid duplicates across orgs.
    const existing = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .first();

    const now = Date.now();
    const payload = {
      organizationId: args.organizationId,
      provider: args.provider ?? existing?.provider,
      stripeAccountId: args.stripeAccountId,
      vortexMerchantAccountId: args.vortexMerchantAccountId ?? existing?.vortexMerchantAccountId,
      accountType: args.accountType,
      chargesEnabled: args.chargesEnabled,
      payoutsEnabled: args.payoutsEnabled,
      detailsSubmitted: args.detailsSubmitted,
      requirements: args.requirements,
      capabilities: args.capabilities,
      feeHandling: args.feeHandling ?? existing?.feeHandling ?? "absorb",
      defaultCurrency: args.defaultCurrency ?? existing?.defaultCurrency,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("stripe_accounts", {
      ...payload,
      createdAt: now,
    });
  },
});

export const markAccountDisconnected = internalMutation({
  args: {
    stripeAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .first();

    if (!existing) {
      return null;
    }

    // Preserve the record but mark it as disconnected.
    await ctx.db.patch(existing._id, {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        disabledReason: "deauthorized",
      },
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});
