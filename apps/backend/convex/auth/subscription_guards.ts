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

/**
 * Throw if adding another member would exceed the org's seat limit.
 */
export async function ensureSeatLimit(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
): Promise<void> {
  const { plan } = await getSubscriptionPlan(db, organizationId);
  const limits = PLAN_LIMITS[plan];

  const members = await db
    .query("organization_members")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (members.length >= limits.maxSeats) {
    throw new ConvexError(
      `You've reached the seat limit for your plan (${members.length}/${limits.maxSeats}). ` +
        (plan === "free"
          ? "Upgrade to Professional to add team members."
          : plan === "pro"
            ? "Upgrade to Enterprise for more than 20 seats."
            : "Contact support to increase your seat limit."),
    );
  }
}

/**
 * Seal's platform fee rates per tier.
 * ACH is passthrough at cost — Seal takes $0 margin on ACH.
 */
const SEAL_FEE_RATES = {
  free: { cardPercent: 0.045, cardFixedCents: 30 },
  pro: { cardPercent: 0.04, cardFixedCents: 30 },
  enterprise: { cardPercent: 0.04, cardFixedCents: 30 }, // Default — overridden by customPaymentRates
} as const;

/**
 * Calculate Seal's application fee for a card payment.
 * Returns 0 for ACH (passthrough at cost).
 */
export function calculateApplicationFee(
  amountCents: number,
  plan: TierPlan,
  isAch: boolean,
  customRates?: { cardRate: number; cardFixed: number },
): number {
  if (isAch) return 0;

  if (customRates) {
    return Math.round(amountCents * customRates.cardRate + customRates.cardFixed);
  }

  const rates = SEAL_FEE_RATES[plan];
  return Math.round(amountCents * rates.cardPercent + rates.cardFixedCents);
}

/**
 * Get the application fee for a payment, resolving the org's tier.
 */
export async function getApplicationFee(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  amountCents: number,
  isAch: boolean,
): Promise<number> {
  const { plan } = await getSubscriptionPlan(db, organizationId);

  // Check for enterprise custom rates
  const org = await db.get(organizationId);
  const customRates = plan === "enterprise"
    ? (org as { customPaymentRates?: { cardRate: number; cardFixed: number } })?.customPaymentRates
    : undefined;

  return calculateApplicationFee(amountCents, plan, isAch, customRates);
}
