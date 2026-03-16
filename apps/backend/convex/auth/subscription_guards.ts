/**
 * Subscription Guard Helpers
 *
 * Plain helper functions for enforcing subscription plan limits.
 * These are NOT Convex functions — they accept `ctx.db` directly
 * and are meant to be called inside mutations/queries.
 */

import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";

/**
 * Feature flags per tier.
 * Documents, signatures, and storage are unlimited on all tiers.
 */
export const PLAN_LIMITS = {
  free: {
    maxSeats: 1,
    templates: false,
    branding: false,
    api: false,
    webhooks: false,
    sso: false,
  },
  pro: {
    maxSeats: 20,
    templates: true,
    branding: true,
    api: true,
    webhooks: true,
    sso: false,
  },
  enterprise: {
    maxSeats: Infinity,
    templates: true,
    branding: true,
    api: true,
    webhooks: true,
    sso: true,
  },
} as const;

/**
 * Determine the user's current subscription plan.
 *
 * Treats `"active"` and `"trialing"` statuses as Pro.
 */
export async function getSubscriptionPlan(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<{ isPro: boolean; plan: "free" | "pro" }> {
  const subscription = await db
    .query("subscriptions")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .order("desc")
    .first();

  if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) {
    return { isPro: false, plan: "free" };
  }

  // Resolve the tier by joining through price → product
  const price = await db
    .query("subscription_prices")
    .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", subscription.externalPriceId))
    .first();

  let tier: string | undefined;
  if (price) {
    const product = await db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) =>
        q.eq("externalProductId", price.externalProductId),
      )
      .first();
    tier = product?.metadata?.tier;
  }

  const isPro = tier === "pro";
  return { isPro, plan: isPro ? "pro" : "free" };
}

/**
 * Throw if the user is not on a Pro plan.
 *
 * Error message intentionally contains "Pro plan" and "upgrade"
 * so `parseConvexError()` classifies it as a subscription error.
 */
export async function ensureProFeature(
  db: DatabaseReader,
  userId: Id<"users">,
  featureName: string,
): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, userId);
  if (!isPro) {
    throw new ConvexError(`${featureName} requires a Pro plan. Please upgrade to continue.`);
  }
}

