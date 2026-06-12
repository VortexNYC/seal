import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";
import { getConnectionStatus } from "../stripe/connect_helpers";
import { merchantAccountResultValidator } from "./merchant_account_validators";

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

    return {
      status,
      account: {
        _id: account._id,
        processorAccountId: account.stripeAccountId,
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
