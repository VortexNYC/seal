/**
 * Stripe Subscription Actions
 *
 * Actions for managing Stripe subscriptions at the organization level:
 * - Creating Stripe customers for new organizations
 * - Auto-enrolling organizations to the default free plan
 * - Managing subscription records
 */

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { selectSaasBillingProvider } from "../payments/saas_billing_provider";
import { getOrCreateStripeCustomer } from "./helpers";

type HandleNewOrgCreatedResult =
  | {
      readonly billingCustomerId: string;
      readonly enrolled: boolean;
      readonly subscriptionId?: string;
    }
  | {
      readonly enrolled: false;
      readonly skippedReason: "vortex_billing";
    };

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

/**
 * Get the default plan lookup key from environment
 */
function getDefaultPlanLookupKey(): string | undefined {
  return process.env.DEFAULT_PLAN_LOOKUP_KEY;
}

// =====================
// INTERNAL MUTATIONS
// =====================

/**
 * Update organization's Stripe customer ID
 */
export const updateOrgBillingCustomerId = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    billingCustomerId: v.string(),
  },
  handler: async (ctx, { organizationId, billingCustomerId }) => {
    await ctx.db.patch(organizationId, {
      billingCustomerId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get price by lookup key
 */
export const getPriceByLookupKey = internalMutation({
  args: {
    lookupKey: v.string(),
  },
  handler: async (ctx, { lookupKey }) => {
    const price = await ctx.db
      .query("subscription_prices")
      .withIndex("by_lookup_key", (q) => q.eq("lookupKey", lookupKey))
      .first();

    if (!price) {
      return null;
    }

    const product = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) =>
        q.eq("externalProductId", price.externalProductId),
      )
      .first();

    return { price, product };
  },
});

/**
 * Create subscription record in Convex
 */
export const createSubscriptionRecord = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    billingCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (existing) {
      console.warn(`Subscription ${args.stripeSubscriptionId} already exists, skipping creation`);
      return existing._id;
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      externalCustomerId: args.billingCustomerId,
      externalSubscriptionId: args.stripeSubscriptionId,
      externalPriceId: args.stripePriceId,
      status: args.status as
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid",
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    console.warn(
      `Created subscription ${args.stripeSubscriptionId} for org ${args.organizationId}`,
    );
    return subscriptionId;
  },
});

// =====================
// INTERNAL ACTIONS
// =====================

/**
 * Handle new organization creation — creates Stripe customer and enrolls to Free plan.
 *
 * Called when a new organization is created.
 * Creates a Stripe customer for the org (no card required) and subscribes to the Free plan.
 */
export const handleNewOrgCreated = internalAction({
  args: {
    organizationId: v.id("organizations"),
    orgName: v.string(),
    adminEmail: v.string(),
  },
  handler: async (
    ctx,
    { organizationId, orgName, adminEmail },
  ): Promise<HandleNewOrgCreatedResult> => {
    if (selectSaasBillingProvider(organizationId) === "vortex_billing") {
      console.warn(`Skipping Stripe org provisioning for Vortex Billing org ${organizationId}`);
      return { enrolled: false, skippedReason: "vortex_billing" };
    }

    const stripe = initializeStripe();

    const billingCustomerId = await getOrCreateStripeCustomer(
      stripe,
      organizationId,
      adminEmail,
      orgName,
      undefined,
    );

    await ctx.runMutation(internal.stripe.subscription_actions.updateOrgBillingCustomerId, {
      organizationId,
      billingCustomerId,
    });

    console.warn(`Created Stripe customer ${billingCustomerId} for org ${organizationId}`);

    const lookupKey = getDefaultPlanLookupKey();
    if (!lookupKey) {
      console.warn("DEFAULT_PLAN_LOOKUP_KEY not configured, skipping free plan enrollment");
      return { billingCustomerId, enrolled: false };
    }

    const existingSub = await ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, {
      organizationId,
    });
    if (existingSub.plan !== "free" || existingSub.isPro) {
      console.warn(`Org ${organizationId} already has a paid subscription, skipping enrollment`);
      return { billingCustomerId, enrolled: false };
    }

    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      {
        lookupKey,
      },
    );

    if (!priceData?.price) {
      console.warn(`Price not found for lookup key ${lookupKey}, skipping enrollment`);
      return { billingCustomerId, enrolled: false };
    }

    try {
      const subscription = await stripe.subscriptions.create({
        customer: billingCustomerId,
        items: [{ price: priceData.price.externalPriceId, quantity: 1 }],
        metadata: { organizationId, lookupKey },
        collection_method: "charge_automatically",
      });

      const firstItem = subscription.items.data[0];
      const periodStart = firstItem?.current_period_start
        ? firstItem.current_period_start * 1000
        : Date.now();
      const periodEnd = firstItem?.current_period_end
        ? firstItem.current_period_end * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      await ctx.runMutation(internal.stripe.subscription_actions.createSubscriptionRecord, {
        organizationId,
        billingCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceData.price.externalPriceId,
        status: subscription.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      console.warn(`Auto-enrolled org ${organizationId} to plan ${lookupKey}`);
      return { billingCustomerId, enrolled: true, subscriptionId: subscription.id };
    } catch (err) {
      console.error("Failed to auto-enroll org to free plan", {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { billingCustomerId, enrolled: false };
    }
  },
});

/**
 * Sync the org's active member count to Stripe subscription quantity.
 *
 * Called when members are added/removed to keep per-seat billing accurate.
 * Finds the org's active subscription and updates the item quantity.
 */
export const syncSeatCount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, { organizationId }) => {
    if (selectSaasBillingProvider(organizationId) === "vortex_billing") {
      console.warn(`Skipping Stripe seat sync for Vortex Billing org ${organizationId}`);
      return;
    }

    const stripe = initializeStripe();

    const org = await ctx.runQuery(internal.organizations.helpers.getOrganizationById, {
      organizationId,
    });
    if (!org?.billingCustomerId) {
      console.warn(`Org ${organizationId} has no Stripe customer, skipping seat sync`);
      return;
    }

    const memberCount: number = await ctx.runQuery(
      internal.organizations.helpers.getActiveMemberCount,
      { organizationId },
    );
    const quantity = Math.max(memberCount, 1);

    const subscriptions = await stripe.subscriptions.list({
      customer: org.billingCustomerId,
      status: "active",
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    if (!subscription) {
      console.warn(`No active Stripe subscription for org ${organizationId}, skipping seat sync`);
      return;
    }

    const item = subscription.items.data[0];
    if (!item) {
      console.warn(`No subscription items for org ${organizationId}, skipping seat sync`);
      return;
    }

    if (item.quantity === quantity) {
      return;
    }

    await stripe.subscriptionItems.update(item.id, { quantity });
    console.warn(`Updated seat count for org ${organizationId}: ${item.quantity} -> ${quantity}`);
  },
});
