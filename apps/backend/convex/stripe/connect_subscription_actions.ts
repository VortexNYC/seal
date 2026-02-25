"use node";

import { v } from "convex/values";
import Stripe from "stripe";

import { action } from "../_generated/server";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

export const pauseSubscription = action({
  args: {
    subscriptionId: v.string(),
    stripeAccountId: v.string(),
  },
  handler: async (_ctx, args) => {
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      args.subscriptionId,
      { pause_collection: { behavior: "void" } },
      { stripeAccount: args.stripeAccountId },
    );

    return { success: true };
  },
});

export const resumeSubscription = action({
  args: {
    subscriptionId: v.string(),
    stripeAccountId: v.string(),
  },
  handler: async (_ctx, args) => {
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      args.subscriptionId,
      { pause_collection: null },
      { stripeAccount: args.stripeAccountId },
    );

    return { success: true };
  },
});

export const cancelSubscription = action({
  args: {
    subscriptionId: v.string(),
    stripeAccountId: v.string(),
  },
  handler: async (_ctx, args) => {
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      args.subscriptionId,
      { cancel_at_period_end: true },
      { stripeAccount: args.stripeAccountId },
    );

    return { success: true };
  },
});
