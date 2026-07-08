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

import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, QueryCtx } from "../_generated/server";
import { listComponentMembersByOrganization } from "../lib/componentOrgReads";
import { selectSaasBillingProvider } from "../payments/saas_billing_provider";
import { PLAN_LIMITS, type TierPlan } from "./plan_limits";
import { resolveSubscriptionPriceAndProductByAnyId } from "../subscription_price_resolver";

export { PLAN_LIMITS, type TierPlan };

// Bounded dunning access: failed renewals keep paid entitlement during retries for 14 days.
export const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

type SubscriptionPlanResult = { isPro: boolean; isEnterprise: boolean; plan: TierPlan };
type PlanSubscription = Pick<
  Doc<"subscriptions">,
  "_creationTime" | "externalPriceId" | "externalSubscriptionId" | "pastDueSince" | "status"
>;

export function isVortexSaasSubscription(
  subscription: Pick<Doc<"subscriptions">, "externalPriceId" | "externalSubscriptionId">,
): boolean {
  return (
    subscription.externalSubscriptionId.startsWith("vtx_") ||
    subscription.externalPriceId.startsWith("vtx_")
  );
}

export function isSubscriptionVisibleForCurrentSaasProvider(
  organizationId: Id<"organizations">,
  subscription: Pick<Doc<"subscriptions">, "externalPriceId" | "externalSubscriptionId">,
): boolean {
  if (selectSaasBillingProvider(organizationId) === "vortex_billing") {
    return true;
  }
  return !isVortexSaasSubscription(subscription);
}

async function getLatestVisibleSubscriptionByStatus(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  status: Doc<"subscriptions">["status"],
): Promise<PlanSubscription | null> {
  const subscriptions = await db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", status),
    )
    .order("desc")
    .take(20);
  return (
    subscriptions.find((subscription) =>
      isSubscriptionVisibleForCurrentSaasProvider(organizationId, subscription),
    ) ?? null
  );
}

async function resolvePlanForSubscription(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  subscription: PlanSubscription,
): Promise<SubscriptionPlanResult> {
  // Resolve the tier by joining through price → product
  const { price, product } = await resolveSubscriptionPriceAndProductByAnyId(
    db,
    subscription.externalPriceId,
  );

  let tier: string | undefined;
  if (!price) {
    console.error(
      JSON.stringify({
        topic: "subscription_guards",
        event: "price_not_found",
        severity: "critical",
        organizationId,
        externalPriceId: subscription.externalPriceId,
        subscriptionStatus: subscription.status,
        timestamp: Date.now(),
      }),
    );
  } else {
    if (!product) {
      console.error(
        JSON.stringify({
          topic: "subscription_guards",
          event: "product_not_found",
          severity: "critical",
          organizationId,
          externalProductId: price.externalProductId,
          externalPriceId: subscription.externalPriceId,
          timestamp: Date.now(),
        }),
      );
    }
    tier = product?.metadata?.tier;
  }

  if (tier === "enterprise") {
    return { isPro: true, isEnterprise: true, plan: "enterprise" };
  }
  if (tier === "pro") {
    return { isPro: true, isEnterprise: false, plan: "pro" };
  }

  // Active subscription but unrecognized tier — likely missing product metadata
  if (tier !== undefined) {
    console.error(
      JSON.stringify({
        topic: "subscription_guards",
        event: "unrecognized_tier_metadata",
        severity: "critical",
        organizationId,
        tier,
        subscriptionId: subscription.externalSubscriptionId,
        priceId: subscription.externalPriceId,
        timestamp: Date.now(),
      }),
    );
  }
  return { isPro: false, isEnterprise: false, plan: "free" };
}

/**
 * Determine an organization's current subscription plan.
 *
 * Treats `"active"`, `"trialing"`, and bounded-grace `"past_due"` statuses as paid tiers.
 * Falls back to `"free"` when no paid subscription exists.
 */
export async function getSubscriptionPlan(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
): Promise<SubscriptionPlanResult> {
  const subscription =
    (await getLatestVisibleSubscriptionByStatus(db, organizationId, "active")) ??
    (await getLatestVisibleSubscriptionByStatus(db, organizationId, "trialing"));

  if (subscription) {
    return await resolvePlanForSubscription(db, organizationId, subscription);
  }

  const pastDueSubscription = await getLatestVisibleSubscriptionByStatus(
    db,
    organizationId,
    "past_due",
  );

  if (pastDueSubscription) {
    const pastDueStartedAt = pastDueSubscription.pastDueSince ?? pastDueSubscription._creationTime;
    if (Date.now() - pastDueStartedAt <= GRACE_PERIOD_MS) {
      return await resolvePlanForSubscription(db, organizationId, pastDueSubscription);
    }
  }

  return { isPro: false, isEnterprise: false, plan: "free" };
}

/**
 * Throw if the organization is not on a Pro (or higher) plan.
 *
 * Error message intentionally contains "Professional plan" and "upgrade"
 * so `parseConvexError()` classifies it as a subscription error.
 */
export async function ensureProFeature(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  featureName: string,
): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, organizationId);
  if (!isPro) {
    throw new ConvexError(
      `${featureName} requires a Professional plan. Please upgrade to continue.`,
    );
  }
}

/**
 * Throw if adding another member would exceed the org's seat limit.
 */
export async function ensureSeatLimit(
  ctx: { db: DatabaseReader; runQuery: QueryCtx["runQuery"] },
  organizationId: Id<"organizations">,
): Promise<void> {
  const { plan } = await getSubscriptionPlan(ctx.db, organizationId);
  const limits = PLAN_LIMITS[plan];

  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found");
  }
  const members = await listComponentMembersByOrganization(ctx, organization, { status: "active" });

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
  const customRates =
    plan === "enterprise"
      ? (org as { customPaymentRates?: { cardRate: number; cardFixed: number } })
          ?.customPaymentRates
      : undefined;

  return calculateApplicationFee(amountCents, plan, isAch, customRates);
}
