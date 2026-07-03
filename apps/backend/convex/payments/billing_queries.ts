import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { authQuery } from "../auth/wrappers";
import { resolveSubscriptionPriceAndProductByAnyId } from "../subscription_price_resolver";
import { availablePlanValidator, billingSubscriptionValidator } from "./billing_query_validators";

type BillingQueryDbCtx = Pick<QueryCtx, "db">;

async function getPriceAndProduct(ctx: BillingQueryDbCtx, externalPriceId: string) {
  return await resolveSubscriptionPriceAndProductByAnyId(ctx.db, externalPriceId);
}

function selectPlanPrices(prices: Doc<"subscription_prices">[]) {
  const monthly = prices.find(
    (price) =>
      price.recurring?.interval === "month" &&
      (price.usageType === "licensed" || price.usageType === undefined),
  );
  const yearly = prices.find(
    (price) =>
      price.recurring?.interval === "year" &&
      (price.usageType === "licensed" || price.usageType === undefined),
  );
  const fallback =
    monthly ??
    yearly ??
    prices.find((price) => price.usageType === "licensed" || price.usageType === undefined);

  return { monthly, yearly, fallback };
}

function toPricing(
  price: Pick<Doc<"subscription_prices">, "unitAmount" | "currency" | "lookupKey"> | undefined,
) {
  if (!price) {
    return null;
  }

  return {
    amount: price.unitAmount ? price.unitAmount / 100 : 0,
    currency: price.currency,
    lookupKey: price.lookupKey ?? null,
  };
}

async function buildAvailablePlan(ctx: BillingQueryDbCtx, product: Doc<"subscription_products">) {
  const prices = await ctx.db
    .query("subscription_prices")
    .withIndex("by_subscription_product_id", (q) => q.eq("subscriptionProductId", product._id))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  const { monthly, yearly, fallback } = selectPlanPrices(prices);
  if (!fallback) {
    return null;
  }

  return {
    productId: product.externalProductId,
    name: product.name,
    description: product.description ?? null,
    tier: product.metadata?.tier ?? null,
    useType: product.metadata?.useType ?? null,
    features: product.metadata?.features ?? null,
    pricing: {
      monthly: toPricing(monthly),
      yearly: toPricing(yearly),
    },
  };
}

async function getCurrentSubscription(ctx: BillingQueryDbCtx, organizationId: Id<"organizations">) {
  return await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .first();
}

function buildSubscriptionDetails(
  subscription: Doc<"subscriptions">,
  price: Doc<"subscription_prices"> | null,
  product: Doc<"subscription_products"> | null,
) {
  return {
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt,
    trialStart: subscription.trialStart,
    trialEnd: subscription.trialEnd,
    ...buildSubscriptionPlanDetails(product),
    ...buildSubscriptionPriceDetails(price),
  };
}

function buildSubscriptionPlanDetails(product: Doc<"subscription_products"> | null) {
  return {
    tier: product?.metadata?.tier ?? "free",
    planName: product?.name ?? "Free",
    features: product?.metadata?.features ?? null,
  };
}

function buildSubscriptionPriceDetails(price: Doc<"subscription_prices"> | null) {
  return {
    unitAmount: price?.unitAmount ?? 0,
    currency: price?.currency ?? "usd",
    interval: price?.recurring?.interval ?? "month",
    intervalCount: price?.recurring?.intervalCount ?? 1,
  };
}

export const getSubscriptionDetails = authQuery({
  args: {},
  returns: v.union(billingSubscriptionValidator, v.null()),
  handler: async (ctx) => {
    const organizationId = ctx.auth.organizationId;
    const subscription = await getCurrentSubscription(ctx, organizationId);

    if (!subscription) {
      return null;
    }

    const { price, product } = await getPriceAndProduct(ctx, subscription.externalPriceId);
    return buildSubscriptionDetails(subscription, price, product);
  },
});

export const getAvailablePlans = query({
  args: {},
  returns: v.array(availablePlanValidator),
  handler: async (ctx) => {
    const products = await ctx.db
      .query("subscription_products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const plans = [];

    for (const product of products) {
      const plan = await buildAvailablePlan(ctx, product);
      if (!plan) {
        continue;
      }

      plans.push(plan);
    }

    plans.sort((a, b) => {
      const aPrice = a.pricing.monthly?.amount ?? a.pricing.yearly?.amount ?? 0;
      const bPrice = b.pricing.monthly?.amount ?? b.pricing.yearly?.amount ?? 0;
      return aPrice - bPrice;
    });

    return plans;
  },
});
