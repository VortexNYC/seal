"use node";

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import { type ActionCtx, action } from "../_generated/server";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

async function resolveProcessorContext(
  ctx: ActionCtx,
  args: { slug: string; subscriptionId: string },
) {
  return await ctx.runQuery(internal.payments.queries.resolveSubscriptionProcessorContext, args);
}

export const pauseSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      processor.processorSubscriptionId,
      { pause_collection: { behavior: "void" } },
      { stripeAccount: processor.processorAccountId },
    );

    return { success: true };
  },
});

export const resumeSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      processor.processorSubscriptionId,
      { pause_collection: null },
      { stripeAccount: processor.processorAccountId },
    );

    return { success: true };
  },
});

export const cancelSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      processor.processorSubscriptionId,
      { cancel_at_period_end: true },
      { stripeAccount: processor.processorAccountId },
    );

    return { success: true };
  },
});
