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
import { getOrCreateStripeCustomer } from "./helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
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
export const updateOrgStripeCustomerId = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { organizationId, stripeCustomerId }) => {
    await ctx.db.patch(organizationId, {
      stripeCustomerId,
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
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if subscription already exists
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
      externalCustomerId: args.stripeCustomerId,
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

    console.warn(`Created subscription ${args.stripeSubscriptionId} for org ${args.organizationId}`);
    return subscriptionId;
  },
});

// =====================
// INTERNAL ACTIONS
// =====================

/**
 * Handle new organization creation — creates Stripe customer and enrolls to Free plan.
 *
 * Called from the Clerk webhook handler (syncOrganization) when a new org is created.
 * Creates a Stripe customer for the org (no card required) and subscribes to the Free plan.
 */
export const handleNewOrgCreated = internalAction({
  args: {
    organizationId: v.id("organizations"),
    orgName: v.string(),
    adminEmail: v.string(),
  },
  handler: async (ctx, { organizationId, orgName, adminEmail }) => {
    const stripe = initializeStripe();

    // 1. Create Stripe customer for the org
    const stripeCustomerId = await getOrCreateStripeCustomer(
      stripe,
      organizationId,
      adminEmail,
      orgName,
      undefined,
    );

    // 2. Save customer ID to org
    await ctx.runMutation(internal.stripe.subscription_actions.updateOrgStripeCustomerId, {
      organizationId,
      stripeCustomerId,
    });

    console.warn(`Created Stripe customer ${stripeCustomerId} for org ${organizationId}`);

    // 3. Auto-enroll to free plan
    const lookupKey = getDefaultPlanLookupKey();
    if (!lookupKey) {
      console.warn("DEFAULT_PLAN_LOOKUP_KEY not configured, skipping free plan enrollment");
      return { stripeCustomerId, enrolled: false };
    }

    // Check for existing subscription
    const existingSub = await ctx.runQuery(
      internal.auth.subscription_helpers.checkProFeature,
      { organizationId },
    );
    if (existingSub.plan !== "free" || existingSub.isPro) {
      console.warn(`Org ${organizationId} already has a paid subscription, skipping enrollment`);
      return { stripeCustomerId, enrolled: false };
    }

    // Get the free plan price
    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey },
    );

    if (!priceData?.price) {
      console.warn(`Price not found for lookup key ${lookupKey}, skipping enrollment`);
      return { stripeCustomerId, enrolled: false };
    }

    // Create the free subscription
    try {
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceData.price.externalPriceId, quantity: 1 }],
        metadata: { organizationId, lookupKey },
        collection_method: "charge_automatically",
      });

      // Save subscription record
      const firstItem = subscription.items.data[0];
      const periodStart = firstItem?.current_period_start
        ? firstItem.current_period_start * 1000
        : Date.now();
      const periodEnd = firstItem?.current_period_end
        ? firstItem.current_period_end * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      await ctx.runMutation(internal.stripe.subscription_actions.createSubscriptionRecord, {
        organizationId,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceData.price.externalPriceId,
        status: subscription.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      console.warn(`Auto-enrolled org ${organizationId} to plan ${lookupKey}`);
      return { stripeCustomerId, enrolled: true, subscriptionId: subscription.id };
    } catch (err) {
      console.error("Failed to auto-enroll org to free plan", {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { stripeCustomerId, enrolled: false };
    }
  },
});
