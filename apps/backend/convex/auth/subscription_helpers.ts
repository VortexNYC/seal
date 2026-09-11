/**
 * Subscription Helpers — Internal Queries + Actions
 *
 * `checkProFeature` remains a query for `convex/api/context.ts`.
 * `getApplicationFeeForOrganization` is an action so it can call the D1
 * `getSubscriptionPlanD1` endpoint and still read the org row.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
  getApplicationFee,
  readEnterpriseCustomRates,
} from "./subscription_guards";

/**
 * Check whether an organization is on a Pro (or higher) plan.
 * Designed to be called from actions via `ctx.runAction(...)`.
 */
export const checkProFeature = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(
      internal.auth.subscription_guards.getSubscriptionPlanD1,
      { organizationId: args.organizationId }
    );
  },
});

export const getApplicationFeeForOrganization = internalAction({
  args: {
    organizationId: v.id("organizations"),
    amountCents: v.number(),
    isAch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const [{ plan }, org] = await Promise.all([
      ctx.runAction(internal.auth.subscription_guards.getSubscriptionPlanD1, {
        organizationId: args.organizationId,
      }),
      ctx.db.get("organizations", args.organizationId),
    ]);

    const customRates =
      plan === "enterprise" ? readEnterpriseCustomRates(org) : undefined;

    return getApplicationFee(args.amountCents, plan, args.isAch, customRates);
  },
});
