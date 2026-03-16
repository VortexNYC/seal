/**
 * Subscription Guard Helpers
 *
 * Plain helper functions for enforcing subscription plan limits.
 * These are NOT Convex functions — they accept `ctx.db` directly
 * and are meant to be called inside mutations/queries.
 *
 * All lookups are scoped to the ORGANIZATION, not the user.
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

export type TierPlan = "free" | "pro" | "enterprise";

/**
 * Determine an organization's current subscription plan.
 *
 * Treats `"active"` and `"trialing"` statuses as paid tiers.
 * Falls back to `"free"` when no active subscription exists.
 */
export async function getSubscriptionPlan(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
): Promise<{ isPro: boolean; isEnterprise: boolean; plan: TierPlan }> {
  const subscription = await db
    .query("subscriptions")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .first();

  if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) {
    return { isPro: false, isEnterprise: false, plan: "free" };
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

  if (tier === "enterprise") {
    return { isPro: true, isEnterprise: true, plan: "enterprise" };
  }
  if (tier === "pro") {
    return { isPro: true, isEnterprise: false, plan: "pro" };
  }
  return { isPro: false, isEnterprise: false, plan: "free" };
}

/**
 * Throw if the organization is not on a Pro (or higher) plan.
 *
 * Error message intentionally contains "Pro plan" and "upgrade"
 * so `parseConvexError()` classifies it as a subscription error.
 */
export async function ensureProFeature(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  featureName: string,
): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, organizationId);
  if (!isPro) {
    throw new ConvexError(`${featureName} requires a Pro plan. Please upgrade to continue.`);
  }
}
