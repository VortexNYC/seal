/**
 * Stripe webhook handler helpers.
 * Pure functions for data extraction, validation, and logging.
 */

import type Stripe from "stripe";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

function timestampToMs(timestamp: number | null | undefined): number | undefined {
  return timestamp ? timestamp * 1000 : undefined;
}

/**
 * Extract and validate subscription data from Stripe webhook.
 * Stripe API 2025-03-31: period dates are in items.data[], not at subscription root.
 */
export function extractSubscriptionData(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const firstItem = subscription.items.data[0];
  if (!firstItem) {
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

  const currentPeriodStart = firstItem.current_period_start;
  const currentPeriodEnd = firstItem.current_period_end;

  if (!currentPeriodStart || !currentPeriodEnd) {
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
    currentPeriodStart: currentPeriodStart * 1000,
    currentPeriodEnd: currentPeriodEnd * 1000,
  };
}

/**
 * Extract and validate invoice data from Stripe webhook.
 */
export function extractInvoiceData(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);

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
 * Log trial conversion events for analytics.
 */
export function logTrialConversionIfNeeded(
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

export const MAX_SUBSCRIPTION_RETRY_ATTEMPTS = 5;

export function getRetryDelayMs(retryCount: number): number {
  const baseDelayMs = 5000;
  return baseDelayMs * 2 ** retryCount;
}

/**
 * Resolve organization from subscription metadata or Stripe customer ID.
 */
export async function resolveOrgForSubscription(
  ctx: MutationCtx,
  metadataOrgId: Id<"organizations"> | undefined,
  billingCustomerId: string,
): Promise<Id<"organizations"> | null> {
  if (metadataOrgId) {
    const org = await ctx.db.get(metadataOrgId);
    if (org) {
      return org._id;
    }
    console.warn(`organizationId ${metadataOrgId} from metadata not found in organizations table`);
  }

  const matchedOrg = await ctx.db
    .query("organizations")
    .withIndex("by_billing_customer", (q) => q.eq("billingCustomerId", billingCustomerId))
    .first();
  if (matchedOrg) {
    console.warn(
      `Resolved organizationId ${matchedOrg._id} from Stripe customer ${billingCustomerId}`,
    );
    return matchedOrg._id;
  }

  const existingSub = await ctx.db
    .query("subscriptions")
    .withIndex("by_external_customer_id", (q) => q.eq("externalCustomerId", billingCustomerId))
    .first();
  if (existingSub?.organizationId) {
    console.warn(
      `Resolved organizationId ${existingSub.organizationId} from existing subscription for customer ${billingCustomerId}`,
    );
    return existingSub.organizationId;
  }

  return null;
}

/**
 * Cancel other active subscriptions for an organization (in Convex DB).
 */
export async function cancelOtherSubscriptions(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
  scheduleStripeCancellation: (subscriptionIds: string[]) => Promise<void>,
): Promise<void> {
  const otherActiveSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    )
    .collect();

  if (otherActiveSubscriptions.length === 0) {
    return;
  }

  const oldSubscriptionIds = otherActiveSubscriptions.map((sub) => sub.externalSubscriptionId);

  console.warn(
    `Found ${otherActiveSubscriptions.length} old active subscription(s) for org ${organizationId}, canceling them`,
  );

  for (const oldSubscription of otherActiveSubscriptions) {
    await ctx.db.patch(oldSubscription._id, {
      status: "canceled",
      updatedAt: now,
    });
  }

  await scheduleStripeCancellation(oldSubscriptionIds);
}
