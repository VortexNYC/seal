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

/* eslint-disable max-lines */

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";

type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

/**
 * Validators for Stripe webhook data
 * We validate only the fields we actually use
 *
 * Note: As of Stripe API 2025-03-31, period dates are in items.data[], not at subscription root
 * Note: We use Stripe's actual types and extract fields in handlers for validation
 */

/**
 * Helper: Convert unix timestamp to milliseconds
 */
function timestampToMs(timestamp: number | null | undefined): number | undefined {
  return timestamp ? timestamp * 1000 : undefined;
}

/**
 * Extract and validate subscription data from Stripe webhook
 * Stripe API 2025-03-31: period dates are in items.data[], not at subscription root
 */
function extractSubscriptionData(subscription: Stripe.Subscription) {
  // Access customer as string (it's expanded in some contexts, but webhooks send ID)
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // Get first subscription item for period dates
  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    // Structured error logging for Axiom analytics
    console.error(
      JSON.stringify({
        topic: "stripe_webhook_errors",
        event: "subscription_missing_items",
        operation: "extractSubscriptionData",
        stripeSubscriptionId: subscription.id,
        customerId,
        status: subscription.status,
        itemsCount: subscription.items.data.length,
        severity: "critical",
        timestamp: Date.now(),
      }),
    );
    throw new Error("Subscription has no items");
  }

  // Extract period dates from subscription item (Stripe API 2025-03-31)
  const currentPeriodStart = firstItem.current_period_start;
  const currentPeriodEnd = firstItem.current_period_end;

  if (!currentPeriodStart || !currentPeriodEnd) {
    // Structured error logging for Axiom analytics
    console.error(
      JSON.stringify({
        topic: "stripe_webhook_errors",
        event: "subscription_missing_period_dates",
        operation: "extractSubscriptionData",
        stripeSubscriptionId: subscription.id,
        customerId,
        priceId: firstItem.price.id,
        hasPeriodStart: !!currentPeriodStart,
        hasPeriodEnd: !!currentPeriodEnd,
        severity: "critical",
        timestamp: Date.now(),
      }),
    );
    throw new Error("Subscription item missing period dates");
  }

  return {
    id: subscription.id,
    customer: customerId,
    status: subscription.status as SubscriptionStatus,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: timestampToMs(subscription.canceled_at),
    cancelReason: subscription.cancellation_details?.reason || undefined,
    trialStart: timestampToMs(subscription.trial_start),
    trialEnd: timestampToMs(subscription.trial_end),
    latestInvoiceId:
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id,
    organizationId: subscription.metadata?.organizationId as Id<"organizations"> | undefined,
    priceId: firstItem.price.id,
    currentPeriodStart: currentPeriodStart * 1000, // Convert to ms
    currentPeriodEnd: currentPeriodEnd * 1000, // Convert to ms
  };
}

/**
 * Extract and validate invoice data from Stripe webhook
 */
function extractInvoiceData(invoice: Stripe.Invoice) {
  // Access customer as string (it's expanded in some contexts, but webhooks send ID)
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);

  // In Stripe API 2025, subscription is in parent.subscription_details.subscription
  const parent = invoice.parent as
    | { subscription_details?: { subscription?: string } }
    | null
    | undefined;
  const subscriptionId = parent?.subscription_details?.subscription;

  return {
    customer: customerId,
    amountPaid: invoice.amount_paid,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    subscription: subscriptionId,
  };
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
      console.error("STRIPE_SECRET_KEY not configured for canceling old subscriptions");
      return;
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    });

    for (const subscriptionId of args.subscriptionIds) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
        console.warn(`Cancelled old Stripe subscription ${subscriptionId} for org ${args.organizationId}`);
      } catch (err) {
        console.error(`Failed to cancel Stripe subscription ${subscriptionId}`, {
          error: err instanceof Error ? err.message : String(err),
          organizationId: args.organizationId,
        });
      }
    }
  },
});

/**
 * Helper: Log trial conversion events for Axiom analytics
 */
function logTrialConversionIfNeeded(
  existingStatus: SubscriptionStatus,
  subscription: {
    id: string;
    organizationId: Id<"organizations"> | undefined;
    customer: string;
    status: SubscriptionStatus;
    trialStart: number | undefined;
    trialEnd: number | undefined;
    cancelReason: string | undefined;
    priceId: string;
  },
): void {
  const wasTrialing = existingStatus === "trialing";
  const nowActive = subscription.status === "active";
  const nowCanceled = subscription.status === "canceled";

  // Trial converted to paid
  if (wasTrialing && nowActive) {
    const trialDurationDays =
      subscription.trialStart && subscription.trialEnd
        ? Math.round((subscription.trialEnd - subscription.trialStart) / (1000 * 60 * 60 * 24))
        : null;

    console.warn(
      JSON.stringify({
        topic: "trial_conversion",
        event: "trial_converted",
        operation: "handleSubscriptionUpdated",
        stripeSubscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        customerId: subscription.customer,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        trialDurationDays,
        stripePriceId: subscription.priceId,
        timestamp: Date.now(),
      }),
    );
  }

  // Trial ended without conversion
  if (wasTrialing && nowCanceled) {
    console.warn(
      JSON.stringify({
        topic: "trial_conversion",
        event: "trial_not_converted",
        operation: "handleSubscriptionUpdated",
        stripeSubscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        customerId: subscription.customer,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        cancelReason: subscription.cancelReason,
        timestamp: Date.now(),
      }),
    );
  }
}

/**
 * Helper: Cancel other active subscriptions for an organization
 */
async function cancelOtherSubscriptions(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<void> {
  const otherActiveSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (otherActiveSubscriptions.length === 0) {
    return;
  }

  const oldSubscriptionIds = otherActiveSubscriptions.map((sub) => sub.externalSubscriptionId);

  console.warn(
    `Found ${otherActiveSubscriptions.length} old active subscription(s) for org ${organizationId}, canceling them`,
  );

  // Cancel old subscriptions in Convex first
  for (const oldSubscription of otherActiveSubscriptions) {
    await ctx.db.patch(oldSubscription._id, {
      status: "canceled",
      updatedAt: now,
    });
  }

  // Schedule cancellation in Stripe (via action)
  await ctx.scheduler.runAfter(0, internal.stripe.handlers.cancelOldStripeSubscriptions, {
    subscriptionIds: oldSubscriptionIds,
    organizationId,
  });
}

/**
 * Handle customer.subscription.created event
 * Creates a new subscription record in Convex
 */
const MAX_SUBSCRIPTION_RETRY_ATTEMPTS = 5;

function getRetryDelayMs(retryCount: number): number {
  const baseDelayMs = 5000; // 5 seconds
  return baseDelayMs * 2 ** retryCount;
  // Results: 5s, 10s, 20s, 40s, 80s (total ~155s)
}

/**
 * Resolve organization from subscription metadata or Stripe customer ID.
 *
 * Strategy 1: Direct organizationId from subscription metadata
 * Strategy 2: Stripe customer ID lookup on organizations table
 * Strategy 3: Stripe customer ID lookup on existing subscriptions table
 */
async function resolveOrgForSubscription(
  ctx: MutationCtx,
  metadataOrgId: Id<"organizations"> | undefined,
  stripeCustomerId: string,
): Promise<Id<"organizations"> | null> {
  // Strategy 1: Direct metadata lookup
  if (metadataOrgId) {
    const org = await ctx.db.get(metadataOrgId);
    if (org) {
      return org._id;
    }
    console.warn(`organizationId ${metadataOrgId} from metadata not found in organizations table`);
  }

  // Strategy 2: Look up org by stripeCustomerId
  const allOrgs = await ctx.db.query("organizations").collect();
  const matchedOrg = allOrgs.find((o) => o.stripeCustomerId === stripeCustomerId);
  if (matchedOrg) {
    console.warn(
      `Resolved organizationId ${matchedOrg._id} from Stripe customer ${stripeCustomerId}`,
    );
    return matchedOrg._id;
  }

  // Strategy 3: Look up via existing subscriptions for this customer
  const existingSub = await ctx.db
    .query("subscriptions")
    .withIndex("by_external_customer_id", (q) => q.eq("externalCustomerId", stripeCustomerId))
    .first();
  if (existingSub) {
    console.warn(
      `Resolved organizationId ${existingSub.organizationId} from existing subscription for customer ${stripeCustomerId}`,
    );
    return existingSub.organizationId;
  }

  return null;
}

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
    await cancelOtherSubscriptions(ctx, resolvedOrgId, now);

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
      apiVersion: "2025-12-15.clover",
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
