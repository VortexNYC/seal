/**
 * Subscription Helpers — Internal Queries
 *
 * These are Convex internalQuery functions for use by actions
 * (which cannot access ctx.db directly).
 */

import { ConvexError, v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { getSubscriptionPlan } from "./subscription_guards";
import { requireActiveMembership } from "./access_control";

/**
 * Check whether an organization is on a Pro (or higher) plan.
 * Designed to be called from actions via `ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, ...)`.
 *
 * When called from an authenticated session, verifies the caller is an active
 * member of the organization before returning subscription details.
 */
export const checkProFeature = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      if (!user) {
        throw new ConvexError("User not found");
      }
      await requireActiveMembership(ctx, user._id, args.organizationId);
    }
    return await getSubscriptionPlan(ctx.db, args.organizationId);
  },
});
