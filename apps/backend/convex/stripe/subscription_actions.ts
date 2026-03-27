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
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type ActionCtx } from "../_generated/server";
import { getOrCreateStripeCustomer } from "./helpers";

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

async function getOrCreateCustomerId(
  ctx: ActionCtx,
  stripe: Stripe,
  userId: Id<"users">,
  user: Doc<"users">,
): Promise<string> {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    stripe,
    userId,
    user.email,
    user.name || user.email,
    undefined,
  );

  await ctx.runMutation(internal.stripe.subscription_actions.updateUserStripeCustomerId, {
    userId,
    stripeCustomerId,
  });

  return stripeCustomerId;
}

async function findExistingStripeSubscription(
  stripe: Stripe,
  userId: Id<"users">,
  stripeCustomerId: string,
): Promise<{ subscriptionId: string; stripePriceId: string } | null> {
  try {
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 10,
    });

    const existingSubscription = stripeSubscriptions.data.find(
      (subscription) =>
        subscription.status !== "canceled" && subscription.status !== "incomplete_expired",
    );

    return existingSubscription
      ? {
          subscriptionId: existingSubscription.id,
          stripePriceId: existingSubscription.items.data[0]?.price?.id ?? "unknown_price_id",
        }
      : null;
  } catch (error) {
    console.error("Failed to check Stripe subscriptions", {
      userId,
      stripeCustomerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function createDefaultPlanSubscription(
  ctx: ActionCtx,
  stripe: Stripe,
  userId: Id<"users">,
  stripeCustomerId: string,
  lookupKey: string,
  stripePriceId: string,
): Promise<SubscribeUserToDefaultPlanResult> {
  const hourWindow = Math.floor(Date.now() / (1000 * 60 * 60));
  const idempotencyKey = `sub_default_${stripeCustomerId}_${hourWindow}`;

  try {
    const subscription = await stripe.subscriptions.create(
      {
        customer: stripeCustomerId,
        items: [{ price: stripePriceId }],
        metadata: {
          userId,
          lookupKey,
          source: "auto_enroll",
        },
        collection_method: "charge_automatically",
      },
      {
        idempotencyKey,
      },
    );

    const firstItem = subscription.items.data[0];
    const currentPeriodStart = firstItem?.current_period_start
      ? firstItem.current_period_start * 1000
      : Date.now();
    const currentPeriodEnd = firstItem?.current_period_end
      ? firstItem.current_period_end * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.stripe.subscription_actions.createSubscriptionRecord, {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status: subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
    });

    console.warn(
      `Auto-enrolled user ${userId} to plan ${lookupKey} with subscription ${subscription.id}`,
    );

    return {
      status: "subscription_created",
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      stripePriceId,
    };
  } catch (error) {
    console.error("Failed to create subscription in Stripe", {
      userId,
      stripeCustomerId,
      lookupKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

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
  handler: async (ctx, { organizationId, orgName, adminEmail }): Promise<{ stripeCustomerId: string; enrolled: boolean; subscriptionId?: string }> => {
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

<<<<<<< HEAD
    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateCustomerId(ctx, stripe, userId, user);

    // Check 2: Check Stripe for existing subscriptions (race condition protection)
    const stripeSubscription = await findExistingStripeSubscription(
      stripe,
      userId,
      stripeCustomerId,
    );
    if (stripeSubscription) {
      console.warn(
        `Found existing Stripe subscription ${stripeSubscription.subscriptionId} for user ${userId}`,
      );
      return {
        status: "already_subscribed",
        subscriptionId: stripeSubscription.subscriptionId,
        stripePriceId: stripeSubscription.stripePriceId,
      };
    }

    // Get the default plan price
=======
    // Get the free plan price
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey },
    );

    if (!priceData?.price) {
      console.warn(`Price not found for lookup key ${lookupKey}, skipping enrollment`);
      return { stripeCustomerId, enrolled: false };
    }

<<<<<<< HEAD
    return await createDefaultPlanSubscription(
      ctx,
      stripe,
      userId,
      stripeCustomerId,
      lookupKey,
      priceData.price.externalPriceId,
    );
=======
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
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
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
    const stripe = initializeStripe();

    // Get org's Stripe customer ID
    const org = await ctx.runQuery(internal.organizations.helpers.getOrganizationById, {
      organizationId,
    });
    if (!org?.stripeCustomerId) {
      console.warn(`Org ${organizationId} has no Stripe customer, skipping seat sync`);
      return;
    }

    // Get active member count
    const memberCount: number = await ctx.runQuery(
      internal.organizations.helpers.getActiveMemberCount,
      { organizationId },
    );
    const quantity = Math.max(memberCount, 1);

    // Find the active Stripe subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripeCustomerId,
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

    // Only update if quantity changed
    if (item.quantity === quantity) {
      return;
    }

    await stripe.subscriptionItems.update(item.id, { quantity });
    console.warn(`Updated seat count for org ${organizationId}: ${item.quantity} → ${quantity}`);
  },
});
