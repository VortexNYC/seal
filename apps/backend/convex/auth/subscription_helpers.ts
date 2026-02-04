/**
 * Subscription Helpers — Internal Queries
 *
 * These are Convex internalQuery functions for use by actions
 * (which cannot access ctx.db directly).
 */

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { getSubscriptionPlan } from "./subscription_guards";

/**
 * Check whether a user is on a Pro plan.
 * Designed to be called from actions via `ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, ...)`.
 */
export const checkProFeature = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await getSubscriptionPlan(ctx.db, args.userId);
  },
});
