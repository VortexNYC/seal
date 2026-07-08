import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";
import { merchantAccountResultValidator } from "./merchant_account_validators";

const operationalMerchantAccountValidator = v.object({
  status: v.union(
    v.literal("not_connected"),
    v.literal("pending"),
    v.literal("restricted"),
    v.literal("connected"),
  ),
  account: v.union(
    v.object({
      _id: v.id("stripe_accounts"),
      provider: v.union(v.literal("stripe"), v.literal("vortex")),
      processorAccountId: v.string(),
      vortexMerchantAccountId: v.optional(v.string()),
      accountType: v.union(v.literal("standard"), v.literal("express")),
      chargesEnabled: v.boolean(),
      payoutsEnabled: v.boolean(),
      detailsSubmitted: v.boolean(),
      feeHandling: v.union(v.literal("absorb"), v.literal("pass_to_recipient")),
      defaultCurrency: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      capabilities: v.optional(
        v.object({
          cardPayments: v.string(),
          transfers: v.string(),
          usBankAccountAchPayments: v.optional(v.string()),
        }),
      ),
      requirements: v.optional(
        v.object({
          currentlyDue: v.array(v.string()),
          eventuallyDue: v.array(v.string()),
          pastDue: v.array(v.string()),
          disabledReason: v.optional(v.string()),
        }),
      ),
    }),
    v.null(),
  ),
  canManage: v.boolean(),
});

export const getMerchantAccount = memberQuery({
  args: {
    slug: v.string(),
  },
  returns: merchantAccountResultValidator,
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const account = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organization._id))
      .first();

    if (!account) {
      return {
        status: "not_connected" as const,
        account: null,
        canManage: ctx.auth.isAdmin(),
      };
    }

    const status = getConnectionStatus({
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      requirements: account.requirements,
    });

    const provider = account.provider ?? "stripe";

    return {
      status,
      account: {
        _id: account._id,
        processorAccountId: resolveProcessorAccountId({
          provider,
          stripeAccountId: account.stripeAccountId,
          vortexMerchantAccountId: account.vortexMerchantAccountId,
        }),
        accountType: account.accountType,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
        feeHandling: account.feeHandling,
        defaultCurrency: account.defaultCurrency,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        capabilities: account.capabilities,
        requirements: account.requirements,
      },
      canManage: ctx.auth.isAdmin(),
    };
  },
});

export const getOperationalMerchantAccount = memberQuery({
  args: {
    slug: v.string(),
  },
  returns: operationalMerchantAccountValidator,
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const account = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organization._id))
      .first();

    if (!account) {
      return {
        status: "not_connected" as const,
        account: null,
        canManage: ctx.auth.isAdmin(),
      };
    }

    const status = getConnectionStatus({
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      requirements: account.requirements,
    });
    const provider = account.provider ?? "stripe";

    return {
      status,
      account: {
        _id: account._id,
        provider,
        processorAccountId: resolveProcessorAccountId({
          provider,
          stripeAccountId: account.stripeAccountId,
          vortexMerchantAccountId: account.vortexMerchantAccountId,
        }),
        vortexMerchantAccountId: account.vortexMerchantAccountId,
        accountType: account.accountType,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
        feeHandling: account.feeHandling,
        defaultCurrency: account.defaultCurrency,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        capabilities: account.capabilities,
        requirements: account.requirements,
      },
      canManage: ctx.auth.isAdmin(),
    };
  },
});

export function resolveProcessorAccountId(input: {
  provider: "stripe" | "vortex";
  stripeAccountId: string;
  vortexMerchantAccountId: string | undefined;
}): string {
  if (input.provider === "vortex" && input.vortexMerchantAccountId !== undefined) {
    return input.vortexMerchantAccountId;
  }

  return input.stripeAccountId;
}

function getConnectionStatus(account: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: {
    currentlyDue: string[];
    disabledReason?: string;
  };
}): "pending" | "restricted" | "connected" {
  if (account.requirements?.disabledReason) {
    return "restricted";
  }

  if (!account.detailsSubmitted || (account.requirements?.currentlyDue?.length ?? 0) > 0) {
    return "pending";
  }

  if (!account.chargesEnabled) {
    return "restricted";
  }

  return "connected";
}
