/**
 * Subscription Helpers — Internal Queries
 *
 * These are Convex internalQuery functions for use by actions
 * (which cannot access ctx.db directly).
 */

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { getApplicationFee, getSubscriptionPlan } from "./subscription_guards";

/**
 * Check whether an organization is on a Pro (or higher) plan.
 * Designed to be called from actions via `ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, ...)`.
 */
export const checkProFeature = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await getSubscriptionPlan(ctx.db, args.organizationId);
  },
});

export const getApplicationFeeForOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    amountCents: v.number(),
    isAch: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await getApplicationFee(
      ctx.db,
      args.organizationId,
      args.amountCents,
      args.isAch
    );
  },
});
