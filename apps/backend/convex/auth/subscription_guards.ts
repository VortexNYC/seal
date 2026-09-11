/**
 * Subscription Guard Helpers
 *
 * Plain helper functions for enforcing subscription plan limits.
 * These are NOT Convex functions — they accept `ctx.db` directly
 * and are meant to be called inside mutations/queries.
 *
 * All lookups are scoped to the ORGANIZATION, not the user.
 */

import { parse } from "@vortexnyc/convex/helpers";
import { addMoney, applyRate, money } from "@vortexnyc/money";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalQuery } from "../_generated/server";
import type { DatabaseReader, QueryCtx } from "../_generated/server";
import {
  listComponentInvitationsByOrganization,
  listComponentMembersByOrganization,
} from "../lib/componentOrgReads";
import { selectSaasBillingProvider } from "../payments/saas_billing_provider";
import { resolveSubscriptionPriceAndProductByAnyId } from "../subscription_price_resolver";
import { PLAN_LIMITS, type TierPlan } from "./plan_limits";

/** US banking convention: round-half-up per line, then sum minor units. */
const FEE_ROUNDING = "half-up" as const;
const FEE_CURRENCY = "USD";

export { PLAN_LIMITS, type TierPlan };

// Bounded dunning access: failed renewals keep paid entitlement during retries for 14 days.
export const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

type SubscriptionPlanResult = {
  isPro: boolean;
  isEnterprise: boolean;
  plan: TierPlan;
};
type PlanSubscription = Pick<
  Doc<"subscriptions">,
  | "_creationTime"
  | "externalPriceId"
  | "externalSubscriptionId"
  | "pastDueSince"
  | "status"
>;

export function isVortexSaasSubscription(
  subscription: Pick<
    Doc<"subscriptions">,
    "externalPriceId" | "externalSubscriptionId"
  >
): boolean {
  return (
    subscription.externalSubscriptionId.startsWith("vtx_") ||
    subscription.externalPriceId.startsWith("vtx_")
  );
}

export function isSubscriptionVisibleForCurrentSaasProvider(
  organizationId: Id<"organizations">,
  subscription: Pick<
    Doc<"subscriptions">,
    "externalPriceId" | "externalSubscriptionId"
  >
): boolean {
  if (selectSaasBillingProvider(organizationId) === "vortex_billing") {
    return true;
  }
  return !isVortexSaasSubscription(subscription);
}

async function getLatestVisibleSubscriptionByStatus(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  status: Doc<"subscriptions">["status"]
): Promise<PlanSubscription | null> {
  const subscriptions = await db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", status)
    )
    .order("desc")
    .take(20);
  return (
    subscriptions.find((subscription) =>
      isSubscriptionVisibleForCurrentSaasProvider(organizationId, subscription)
    ) ?? null
  );
}

async function resolvePlanForSubscription(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  subscription: PlanSubscription
): Promise<SubscriptionPlanResult> {
  // Resolve the tier by joining through price → product
  const { price, product } = await resolveSubscriptionPriceAndProductByAnyId(
    db,
    subscription.externalPriceId
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
      })
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
        })
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
      })
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
  organizationId: Id<"organizations">
): Promise<SubscriptionPlanResult> {
  const subscription =
    (await getLatestVisibleSubscriptionByStatus(
      db,
      organizationId,
      "active"
    )) ??
    (await getLatestVisibleSubscriptionByStatus(
      db,
      organizationId,
      "trialing"
    ));

  if (subscription) {
    return await resolvePlanForSubscription(db, organizationId, subscription);
  }

  const pastDueSubscription = await getLatestVisibleSubscriptionByStatus(
    db,
    organizationId,
    "past_due"
  );

  if (pastDueSubscription) {
    const pastDueStartedAt =
      pastDueSubscription.pastDueSince ?? pastDueSubscription._creationTime;
    if (Date.now() - pastDueStartedAt <= GRACE_PERIOD_MS) {
      return await resolvePlanForSubscription(
        db,
        organizationId,
        pastDueSubscription
      );
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
  featureName: string
): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, organizationId);
  if (!isPro) {
    throw new ConvexError(
      `${featureName} requires a Professional plan. Please upgrade to continue.`
    );
  }
}

/**
 * Throw if adding another member would exceed the org's seat limit.
 *
 * Pass `includePendingInvites: true` when creating invitations so pending
 * invites reserve seats (SEA-605). Redeem / addMember only count active members.
 */
export async function ensureSeatLimit(
  ctx: { db: DatabaseReader; runQuery: QueryCtx["runQuery"] },
  organizationId: Id<"organizations">,
  options?: { includePendingInvites?: boolean }
): Promise<void> {
  const { plan } = await getSubscriptionPlan(ctx.db, organizationId);
  const limits = PLAN_LIMITS[plan];

  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found");
  }
  const members = await listComponentMembersByOrganization(ctx, organization, {
    status: "active",
  });

  let occupied = members.length;
  if (options?.includePendingInvites) {
    const pending = await listComponentInvitationsByOrganization(
      ctx,
      organization,
      "pending"
    );
    occupied += pending.length;
  }

  if (occupied >= limits.maxSeats) {
    const seatLabel =
      limits.maxSeats === Infinity ? "unlimited" : String(limits.maxSeats);
    throw new ConvexError(
      `You've reached the seat limit for your plan (${occupied}/${seatLabel}). ` +
        (plan === "free"
          ? "Upgrade to Professional to add team members."
          : plan === "pro"
            ? "Upgrade to Enterprise for more than 20 seats."
            : "Contact support to increase your seat limit.")
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
  customRates?: { cardRate: number; cardFixed: number }
): number {
  if (isAch) return 0;

  const charge = money(amountCents, FEE_CURRENCY);
  if (customRates) {
    return addMoney(
      applyRate(charge, customRates.cardRate, FEE_ROUNDING),
      money(customRates.cardFixed, FEE_CURRENCY)
    ).amount;
  }

  const rates = SEAL_FEE_RATES[plan];
  return addMoney(
    applyRate(charge, rates.cardPercent, FEE_ROUNDING),
    money(rates.cardFixedCents, FEE_CURRENCY)
  ).amount;
}

export function readEnterpriseCustomRates(
  org: Doc<"organizations"> | null
): { cardRate: number; cardFixed: number } | undefined {
  if (org === null) {
    return undefined;
  }
  const raw = Object.getOwnPropertyDescriptor(org, "customPaymentRates")?.value;
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  if (!("cardRate" in raw) || !("cardFixed" in raw)) {
    return undefined;
  }
  const { cardRate, cardFixed } = raw;
  if (typeof cardRate !== "number" || typeof cardFixed !== "number") {
    return undefined;
  }
  return { cardRate, cardFixed };
}

/**
 * Get the application fee for a payment given a plan and optional custom rates.
 */
export function getApplicationFee(
  amountCents: number,
  plan: TierPlan,
  isAch: boolean,
  customRates?: { cardRate: number; cardFixed: number }
): number {
  return calculateApplicationFee(amountCents, plan, isAch, customRates);
}

export const getSubscriptionPlanQuery = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await getSubscriptionPlan(ctx.db, args.organizationId);
  },
});

/**
 * D1-backed subscription plan lookup.
 *
 * Calls the Worker endpoint first. If the Worker is unavailable, falls back
 * to the Convex `getSubscriptionPlan` helper.
 */
const subscriptionPlanResponseValidator = v.object({
  isPro: v.boolean(),
  isEnterprise: v.boolean(),
  plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
});

/**
 * D1-backed subscription plan lookup.
 *
 * Calls the Worker endpoint first. If the Worker is unavailable, falls back
 * to the Convex `getSubscriptionPlan` helper.
 */
export const getSubscriptionPlanD1 = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: subscriptionPlanResponseValidator,
  handler: async (ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return await ctx.runQuery(
        internal.auth.subscription_guards.getSubscriptionPlanQuery,
        { organizationId: args.organizationId }
      );
    }

    const res = await fetch(
      `${url}/internal/organizations/${encodeURIComponent(
        args.organizationId
      )}/subscription-plan`,
      {
        headers: {
          "x-internal-api-key": key,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Worker subscription-plan failed: ${res.status} ${text}`);
      return await ctx.runQuery(
        internal.auth.subscription_guards.getSubscriptionPlanQuery,
        { organizationId: args.organizationId }
      );
    }

    try {
      const body = await res.json();
      return parse(subscriptionPlanResponseValidator, body);
    } catch (error) {
      console.error("Failed to parse Worker subscription-plan:", error);
      return await ctx.runQuery(
        internal.auth.subscription_guards.getSubscriptionPlanQuery,
        { organizationId: args.organizationId }
      );
    }
  },
});

export const getSeatCounts = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const members = await listComponentMembersByOrganization(
      ctx,
      organization,
      { status: "active" }
    );
    const pending = await listComponentInvitationsByOrganization(
      ctx,
      organization,
      "pending"
    );
    return { active: members.length, pending: pending.length };
  },
});

/**
 * Throw if the organization is not on a Pro (or higher) plan.
 *
 * Error message intentionally contains "Professional plan" and "upgrade"
 * so `parseConvexError()` classifies it as a subscription error.
 */
export const ensureProFeatureD1 = internalAction({
  args: {
    organizationId: v.id("organizations"),
    featureName: v.string(),
  },
  handler: async (ctx, args) => {
    const { isPro } = await ctx.runAction(
      internal.auth.subscription_guards.getSubscriptionPlanD1,
      { organizationId: args.organizationId }
    );
    if (!isPro) {
      throw new ConvexError(
        `${args.featureName} requires a Professional plan. Please upgrade to continue.`
      );
    }
  },
});

/**
 * Throw if adding another member would exceed the org's seat limit.
 *
 * Pass `includePendingInvites: true` when creating invitations so pending
 * invites reserve seats (SEA-605). Redeem / addMember only count active members.
 */
export const ensureSeatLimitD1 = internalAction({
  args: {
    organizationId: v.id("organizations"),
    includePendingInvites: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { plan } = await ctx.runAction(
      internal.auth.subscription_guards.getSubscriptionPlanD1,
      { organizationId: args.organizationId }
    );
    const limits = PLAN_LIMITS[plan];

    const { active, pending } = await ctx.runQuery(
      internal.auth.subscription_guards.getSeatCounts,
      { organizationId: args.organizationId }
    );

    const occupied = args.includePendingInvites ? active + pending : active;
    if (occupied >= limits.maxSeats) {
      const seatLabel =
        limits.maxSeats === Infinity ? "unlimited" : String(limits.maxSeats);
      throw new ConvexError(
        `You've reached the seat limit for your plan (${occupied}/${seatLabel}). ` +
          (plan === "free"
            ? "Upgrade to Professional to add team members."
            : plan === "pro"
              ? "Upgrade to Enterprise for more than 20 seats."
              : "Contact support to increase your seat limit.")
      );
    }
  },
});
