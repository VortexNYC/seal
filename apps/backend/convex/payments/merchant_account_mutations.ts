import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { adminMutation } from "../auth";
import { feeHandlingValidator } from "./merchant_account_validators";

export const getAccountByOrganizationId = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("merchant_accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();
  },
});

export const upsertMerchantAccount = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    providerAccountId: v.string(),
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
      })
    ),
    capabilities: v.optional(
      v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      })
    ),
    feeHandling: v.optional(
      v.union(v.literal("absorb"), v.literal("pass_to_recipient"))
    ),
    defaultCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("merchant_accounts")
      .withIndex("by_provider_account", (q) =>
        q.eq("providerAccountId", args.providerAccountId)
      )
      .first();

    const now = Date.now();
    const payload = {
      organizationId: args.organizationId,
      provider: "vortex" as const,
      providerAccountId: args.providerAccountId,
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
      await ctx.db.patch("merchant_accounts", existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("merchant_accounts", {
      ...payload,
      createdAt: now,
    });
  },
});

export const updateFeeHandling = adminMutation({
  args: {
    feeHandling: feeHandlingValidator,
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("merchant_accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.auth.organization._id)
      )
      .first();

    if (!account) {
      throw new ConvexError("Merchant account not connected");
    }

    await ctx.db.patch("merchant_accounts", account._id, {
      feeHandling: args.feeHandling,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
