/**
 * Stripe Webhook Handler
 *
 * Processes Stripe webhook events to sync subscription data with Convex.
 *
 * Events handled:
 * - customer.subscription.created: Create subscription record
 * - customer.subscription.updated: Update subscription status/dates
 * - customer.subscription.deleted: Mark subscription as canceled
 * - invoice.payment_succeeded: Confirm payment received
 * - invoice.payment_failed: Handle failed payments
 */

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";

import {
  type SubscriptionStatus,
  cancelOtherSubscriptions,
  extractInvoiceData,
  extractSubscriptionData,
  getRetryDelayMs,
  logTrialConversionIfNeeded,
  MAX_SUBSCRIPTION_RETRY_ATTEMPTS,
  resolveOrgForSubscription,
} from "./handler_helpers";

// Note: cancelOtherSubscriptions needs a scheduler callback since it can't import `internal` directly
async function cancelOtherSubscriptionsForOrg(
  ctx: Parameters<typeof cancelOtherSubscriptions>[0],
  organizationId: Id<"organizations">,
  now: number,
): Promise<void> {
  await cancelOtherSubscriptions(ctx, organizationId, now, async (subscriptionIds) => {
    await ctx.scheduler.runAfter(0, internal.stripe.handlers.cancelOldStripeSubscriptions, {
      subscriptionIds,
      organizationId,
    });
  });
}

/**
 * Cancel old Stripe subscriptions for a user
 * Helper action to cancel subscriptions in Stripe
 */
export const cancelOldStripeSubscriptions = internalAction({
  args: {
    subscriptionIds: v.array(v.string()),
    organizationId: v.string(),
  },
  handler: async (_ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured — cannot cancel old subscriptions");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const failures: string[] = [];
    for (const subscriptionId of args.subscriptionIds) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
        console.warn(`Cancelled old Stripe subscription ${subscriptionId} for org ${args.organizationId}`);
      } catch (err) {
        failures.push(subscriptionId);
        console.error(`Failed to cancel Stripe subscription ${subscriptionId}`, {
          error: err instanceof Error ? err.message : String(err),
          organizationId: args.organizationId,
        });
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Failed to cancel ${failures.length}/${args.subscriptionIds.length} Stripe subscriptions: ${failures.join(", ")}`,
      );
    }
  },
});

export const handleSubscriptionCreated = internalMutation({
  args: {
    subscription: v.any(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args: { subscription: Stripe.Subscription; retryCount?: number }) => {
    const subscription = extractSubscriptionData(args.subscription);
    const retryCount = args.retryCount ?? 0;

    // Resolve organizationId with multi-strategy fallback
    const resolvedOrgId = await resolveOrgForSubscription(
      ctx,
      subscription.organizationId,
      subscription.customer,
    );

    if (!resolvedOrgId) {
      if (retryCount < MAX_SUBSCRIPTION_RETRY_ATTEMPTS) {
        const delayMs = getRetryDelayMs(retryCount);
        console.warn(
          `Organization not found for subscription ${subscription.id} (customer ${subscription.customer}), scheduling retry ${retryCount + 1}/${MAX_SUBSCRIPTION_RETRY_ATTEMPTS} in ${delayMs / 1000}s`,
        );
        await ctx.scheduler.runAfter(delayMs, internal.stripe.handlers.handleSubscriptionCreated, {
          subscription: args.subscription,
          retryCount: retryCount + 1,
        });
        return;
      }
      throw new Error(
        `Organization not found for subscription ${subscription.id} (customer ${subscription.customer}) after ${MAX_SUBSCRIPTION_RETRY_ATTEMPTS} retries`,
      );
    }

    const now = Date.now();

    // Check if subscription already exists (prevent duplicates from webhook retries)
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", subscription.id),
      )
      .first();

    if (existingSubscription) {
      console.warn(`Subscription ${subscription.id} already exists, updating instead`);

      await ctx.db.patch(existingSubscription._id, {
        externalPriceId: subscription.priceId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        cancelReason: subscription.cancelReason,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        latestInvoiceId: subscription.latestInvoiceId,
        updatedAt: now,
      });
      return;
    }

    // Cancel any other active subscriptions for this org
    await cancelOtherSubscriptionsForOrg(ctx, resolvedOrgId, now);

    await ctx.db.insert("subscriptions", {
      organizationId: resolvedOrgId,
      externalCustomerId: subscription.customer,
      externalSubscriptionId: subscription.id,
      externalPriceId: subscription.priceId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      cancelReason: subscription.cancelReason,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      latestInvoiceId: subscription.latestInvoiceId,
      createdAt: now,
      updatedAt: now,
    });

    console.warn(`Created subscription for org ${resolvedOrgId}: ${subscription.id}`);
  },
});

/**
 * Handle customer.subscription.updated event
 * Updates subscription record in Convex
 * Handles plan changes (upgrade/downgrade) while preserving usage history
 */
export const handleSubscriptionUpdated = internalMutation({
  args: { subscription: v.any() },
  handler: async (ctx, args: { subscription: Stripe.Subscription }) => {
    const subscription = extractSubscriptionData(args.subscription);

    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", subscription.id),
      )
      .first();

    if (!existingSubscription) {
      console.error("Subscription not found for update", {
        operation: "handleSubscriptionUpdated",
        stripeSubscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        stripePriceId: subscription.priceId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        timestamp: Date.now(),
      });
      throw new Error(
        `Subscription not found for update - stripeSubscriptionId: ${subscription.id}`,
      );
    }

    const planChanged = existingSubscription.externalPriceId !== subscription.priceId;

    const updateData: Record<string, unknown> = {
      externalPriceId: planChanged ? subscription.priceId : existingSubscription.externalPriceId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      cancelReason: subscription.cancelReason,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      latestInvoiceId: subscription.latestInvoiceId,
      updatedAt: Date.now(),
    };

    if (planChanged) {
      console.warn(
        `Plan changed for subscription ${subscription.id}: price ${existingSubscription.externalPriceId} -> ${subscription.priceId}`,
      );
    }

    await ctx.db.patch(existingSubscription._id, updateData);

    logTrialConversionIfNeeded(existingSubscription.status, subscription);

    const wasActive =
      existingSubscription.status === "active" || existingSubscription.status === "trialing";
    const isNowInactive =
      subscription.status === "canceled" ||
      subscription.status === "past_due" ||
      subscription.status === "incomplete_expired" ||
      subscription.status === "unpaid";

    if (wasActive && isNowInactive) {
      await ctx.scheduler.runAfter(
        0,
        internal.webhooks.delivery.abandonPendingDeliveriesForOrg,
        { organizationId: existingSubscription.organizationId },
      );
      console.warn(
        JSON.stringify({
          topic: "subscription_lifecycle",
          event: "downgrade_cascade_triggered",
          organizationId: existingSubscription.organizationId,
          stripeSubscriptionId: subscription.id,
          previousStatus: existingSubscription.status,
          newStatus: subscription.status,
          timestamp: Date.now(),
        }),
      );
    }

    // Explicit past_due detection — features remain active during grace period
    if (existingSubscription.status !== "past_due" && subscription.status === "past_due") {
      console.warn(
        JSON.stringify({
          topic: "subscription_lifecycle",
          event: "subscription_past_due",
          severity: "warning",
          operation: "handleSubscriptionUpdated",
          stripeSubscriptionId: subscription.id,
          organizationId: existingSubscription.organizationId,
          customerId: subscription.customer,
          previousStatus: existingSubscription.status,
          stripePriceId: subscription.priceId,
          timestamp: Date.now(),
        }),
      );
    }

    console.warn(`Updated subscription: ${subscription.id}`);
  },
});

/**
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled and triggers sharing cleanup
 */
export const handleSubscriptionDeleted = internalMutation({
  args: { subscription: v.any() },
  handler: async (ctx, args: { subscription: Stripe.Subscription }) => {
    const subscription = extractSubscriptionData(args.subscription);

    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", subscription.id),
      )
      .first();

    if (!existingSubscription) {
      console.error("Subscription not found for deletion", {
        operation: "handleSubscriptionDeleted",
        stripeSubscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        stripePriceId: subscription.priceId,
        status: subscription.status,
        timestamp: Date.now(),
      });
      throw new Error(
        `Subscription not found for deletion - stripeSubscriptionId: ${subscription.id}`,
      );
    }

    const now = Date.now();
    await ctx.db.patch(existingSubscription._id, {
      status: "canceled",
      canceledAt: subscription.canceledAt || now,
      cancelReason: subscription.cancelReason,
      updatedAt: now,
    });

    // Downgrade cascade: abandon pending webhook deliveries
    await ctx.scheduler.runAfter(
      0,
      internal.webhooks.delivery.abandonPendingDeliveriesForOrg,
      { organizationId: existingSubscription.organizationId },
    );
    console.warn(
      JSON.stringify({
        topic: "subscription_lifecycle",
        event: "downgrade_cascade_triggered",
        operation: "handleSubscriptionDeleted",
        organizationId: existingSubscription.organizationId,
        stripeSubscriptionId: subscription.id,
        customerId: subscription.customer,
        previousStatus: existingSubscription.status,
        cancelReason: subscription.cancelReason,
        timestamp: now,
      }),
    );

    console.warn(
      JSON.stringify({
        topic: "subscription_lifecycle",
        event: "subscription_canceled",
        operation: "handleSubscriptionDeleted",
        stripeSubscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        customerId: subscription.customer,
        cancelReason: subscription.cancelReason,
        canceledAt: subscription.canceledAt || now,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        timestamp: now,
      }),
    );

    console.warn(`Deleted subscription: ${subscription.id}`);
  },
});

/**
 * Handle invoice.payment_succeeded event
 * Resets monthly credits on subscription renewal (but NOT on plan changes)
 */
export const handlePaymentSucceeded = internalMutation({
  args: { invoice: v.any() },
  handler: async (ctx, args: { invoice: Stripe.Invoice }) => {
    const invoice = extractInvoiceData(args.invoice);
    const fullInvoice = args.invoice as Stripe.Invoice;

    console.warn(
      `Payment succeeded for customer ${invoice.customer}: ${invoice.amountPaid / 100} ${invoice.currency}`,
    );

    // Structured logging for Axiom analytics
    console.warn(
      JSON.stringify({
        topic: "payment_events",
        event: "payment_succeeded",
        operation: "handlePaymentSucceeded",
        stripeInvoiceId: fullInvoice.id,
        invoiceStatus: fullInvoice.status,
        subscriptionId: invoice.subscription,
        customerId: invoice.customer,
        amountPaid: invoice.amountPaid,
        amountCents: invoice.amountPaid, // For easier revenue calculations
        currency: invoice.currency,
        billingReason: fullInvoice.billing_reason,
        timestamp: Date.now(),
      }),
    );

    // Update subscription with latest invoice info
    if (invoice.subscription) {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_external_subscription_id", (q) =>
          q.eq("externalSubscriptionId", invoice.subscription as string),
        )
        .first();

      if (subscription) {
        await ctx.db.patch(subscription._id, {
          latestInvoiceId: fullInvoice.id,
          latestInvoiceStatus: fullInvoice.status || undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Handle invoice.payment_failed event
 * Logs failed payment and potentially notifies user
 */
export const handlePaymentFailed = internalMutation({
  args: { invoice: v.any() },
  handler: async (ctx, args: { invoice: Stripe.Invoice }) => {
    const invoice = extractInvoiceData(args.invoice);
    const fullInvoice = args.invoice as Stripe.Invoice;

    // Structured logging for Axiom analytics
    console.error(
      JSON.stringify({
        topic: "payment_events",
        event: "payment_failed",
        operation: "handlePaymentFailed",
        stripeInvoiceId: fullInvoice.id,
        invoiceStatus: fullInvoice.status,
        subscriptionId: invoice.subscription,
        customerId: invoice.customer,
        amountDue: invoice.amountDue,
        currency: invoice.currency,
        attemptCount: fullInvoice.attempt_count,
        severity: "critical",
        timestamp: Date.now(),
      }),
    );

    // Update subscription status if it exists
    if (invoice.subscription) {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_external_subscription_id", (q) =>
          q.eq("externalSubscriptionId", invoice.subscription as string),
        )
        .first();

      if (subscription) {
        await ctx.db.patch(subscription._id, {
          status: "past_due",
          latestInvoiceId: fullInvoice.id,
          latestInvoiceStatus: fullInvoice.status || undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Helper: Get subscriptions that need status checking
 */
export const getSubscriptionsToCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const pastDue = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "past_due"))
      .collect();

    const trialing = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "trialing"))
      .collect();

    const subscriptions = [...active, ...pastDue, ...trialing];

    return subscriptions.map((sub) => ({
      id: sub._id,
      stripeSubscriptionId: sub.externalSubscriptionId,
      status: sub.status,
    }));
  },
});

/**
 * Helper: Update subscription from Stripe data
 */
export const updateSubscriptionFromStripe = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      status: args.status as SubscriptionStatus,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Check Subscription Status
 *
 * Periodically verify that subscription states are in sync with Stripe.
 * Called by daily cron job to catch any missed webhooks.
 */
export const checkSubscriptionStatus = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured for checkSubscriptionStatus", {
        operation: "checkSubscriptionStatus",
        cronJob: true,
        requiredConfig: "STRIPE_SECRET_KEY",
        timestamp: Date.now(),
      });
      throw new Error(
        "STRIPE_SECRET_KEY not configured - checkSubscriptionStatus cron job cannot run",
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    // Get all active or past_due subscriptions
    const subscriptions = await ctx.runMutation(
      internal.stripe.handlers.getSubscriptionsToCheck,
      {},
    );

    console.warn(`Checking status for ${subscriptions.length} subscriptions`);

    for (const subscription of subscriptions) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
        );

        // Period dates are stored in the subscription item, not the subscription itself
        const item = stripeSubscription.items?.data?.[0] as unknown as
          | Record<string, unknown>
          | undefined;
        const currentPeriodStart = item?.current_period_start as number | undefined;
        const currentPeriodEnd = item?.current_period_end as number | undefined;

        if (!currentPeriodStart || !currentPeriodEnd) {
          console.error("Missing period dates for subscription", {
            operation: "checkSubscriptionStatus.missingDates",
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            willContinue: true,
          });
          continue;
        }

        console.warn(
          `Syncing subscription ${subscription.stripeSubscriptionId}: ${subscription.status} -> ${stripeSubscription.status}`,
        );

        await ctx.runMutation(internal.stripe.handlers.updateSubscriptionFromStripe, {
          subscriptionId: subscription.id,
          status: stripeSubscription.status,
          currentPeriodStart: currentPeriodStart * 1000,
          currentPeriodEnd: currentPeriodEnd * 1000,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        });
      } catch (err) {
        console.error("Failed to check subscription status", {
          operation: "checkSubscriptionStatus",
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          willContinue: true,
        });
      }
    }

    console.warn("Subscription status check complete");
  },
});
