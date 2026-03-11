/**
 * Stripe Subscription Actions
 *
 * Actions for managing Stripe subscriptions, including:
 * - Creating Stripe customers for new users
 * - Auto-enrolling users to the default free plan
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
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Check if auto-enroll is enabled via environment variable
 */
function isAutoEnrollEnabled(): boolean {
  const autoEnroll = process.env.AUTO_ENROLL_FREE_PLAN_ON_SIGNUP;
  return Boolean(autoEnroll && ["1", "true", "TRUE", "yes", "on"].includes(autoEnroll));
}

/**
 * Get the default plan lookup key from environment
 */
function getDefaultPlanLookupKey(): string | undefined {
  return process.env.DEFAULT_PLAN_LOOKUP_KEY;
}

/**
 * Update user's Stripe customer ID
 */
export const updateUserStripeCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, {
      stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get user data for subscription creation
 */
export const getUserForSubscription = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Check for existing active subscription
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing")))
      .first();

    return {
      user,
      existingSubscription,
    };
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

    // Get product to retrieve metadata
    const product = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) =>
        q.eq("externalProductId", price.externalProductId),
      )
      .first();

    return {
      price,
      product,
    };
  },
});

/**
 * Create subscription record in Convex
 */
export const createSubscriptionRecord = internalMutation({
  args: {
    userId: v.id("users"),
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
      userId: args.userId,
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

    console.warn(`Created subscription ${args.stripeSubscriptionId} for user ${args.userId}`);

    return subscriptionId;
  },
});

export type SubscribeUserToDefaultPlanResult =
  | {
      status: "already_subscribed";
      subscriptionId: string;
      stripePriceId: string;
    }
  | {
      status: "subscription_created";
      stripeSubscriptionId: string;
      stripeCustomerId: string;
      stripePriceId: string;
    }
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "error";
      error: string;
    };

export type HandleNewUserSignupResult = {
  stripeCustomerId: string;
  enrollmentResult: SubscribeUserToDefaultPlanResult;
};

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
 * Subscribe a user to the default free plan
 *
 * This action:
 * 1. Creates a Stripe customer if needed
 * 2. Checks for existing subscriptions (both in Convex and Stripe)
 * 3. Creates a subscription to the default plan
 * 4. Records the subscription in Convex
 */
export const subscribeUserToDefaultPlan = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }): Promise<SubscribeUserToDefaultPlanResult> => {
    const lookupKey = getDefaultPlanLookupKey();
    if (!lookupKey) {
      console.warn("DEFAULT_PLAN_LOOKUP_KEY not configured, skipping auto-enrollment");
      return {
        status: "skipped",
        reason: "DEFAULT_PLAN_LOOKUP_KEY not configured",
      };
    }

    const stripe = initializeStripe();

    // Get user data and check for existing subscription
    const data = await ctx.runMutation(
      internal.stripe.subscription_actions.getUserForSubscription,
      { userId },
    );

    if (!data || !data.user) {
      console.error(`User ${userId} not found for auto-enrollment`);
      return { status: "error", error: "User not found" };
    }

    const { user, existingSubscription } = data;

    // Check 1: If Convex already has an active subscription, return it
    if (existingSubscription) {
      console.warn(
        `User ${userId} already has subscription ${existingSubscription.externalSubscriptionId}`,
      );
      return {
        status: "already_subscribed",
        subscriptionId: existingSubscription.externalSubscriptionId,
        stripePriceId: existingSubscription.externalPriceId,
      };
    }

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
    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey },
    );

    if (!priceData || !priceData.price) {
      console.error(`Price not found for lookup key ${lookupKey}`);
      return {
        status: "error",
        error: `Price not found for lookup key ${lookupKey}`,
      };
    }

    return await createDefaultPlanSubscription(
      ctx,
      stripe,
      userId,
      stripeCustomerId,
      lookupKey,
      priceData.price.externalPriceId,
    );
  },
});

/**
 * Handle new user signup - creates Stripe customer and optionally enrolls to free plan
 *
 * This is called from the Clerk webhook handler after user creation.
 */
export const handleNewUserSignup = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { userId, email, name }): Promise<HandleNewUserSignupResult> => {
    const stripe = initializeStripe();

    // Create Stripe customer
    let stripeCustomerId: string;
    try {
      stripeCustomerId = await getOrCreateStripeCustomer(
        stripe,
        userId,
        email,
        name || email,
        undefined,
      );

      // Save customer ID to user
      await ctx.runMutation(internal.stripe.subscription_actions.updateUserStripeCustomerId, {
        userId,
        stripeCustomerId,
      });

      console.warn(`Created Stripe customer ${stripeCustomerId} for user ${userId}`);
    } catch (err) {
      console.error("Failed to create Stripe customer", {
        userId,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Auto-enroll to free plan if enabled
    if (isAutoEnrollEnabled()) {
      try {
        const result = await ctx.runAction(
          internal.stripe.subscription_actions.subscribeUserToDefaultPlan,
          { userId },
        );

        if (result.status === "error") {
          console.error("Auto-enrollment failed", {
            userId,
            error: result.error,
          });
        } else {
          console.warn(`Auto-enrollment result for user ${userId}:`, result);
        }

        return { stripeCustomerId, enrollmentResult: result };
      } catch (err) {
        console.error("Auto-enrollment failed with exception", {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Don't throw - customer was created successfully
        return {
          stripeCustomerId,
          enrollmentResult: {
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          },
        };
      }
    }

    return {
      stripeCustomerId,
      enrollmentResult: { status: "skipped", reason: "Auto-enroll disabled" },
    };
  },
});
