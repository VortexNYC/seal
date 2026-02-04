/**
 * SUBSCRIPTIONS TABLE
 * Stripe subscription data for users.
 * Synced via Stripe webhooks.
 */

import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const subscriptionStatus = v.union(
  v.literal("active"),
  v.literal("canceled"),
  v.literal("past_due"),
  v.literal("trialing"),
  v.literal("incomplete"),
  v.literal("incomplete_expired"),
  v.literal("unpaid"),
);
export type SubscriptionStatus = Infer<typeof subscriptionStatus>;

export const subscriptionsTable = defineTable({
  userId: v.id("users"),

  externalCustomerId: v.string(), // Stripe customer ID
  externalSubscriptionId: v.string(), // Stripe subscription ID
  externalPriceId: v.string(), // Stripe price ID (base subscription)
  status: subscriptionStatus,
  currentPeriodStart: v.number(), // Unix timestamp
  currentPeriodEnd: v.number(), // Unix timestamp
  cancelAtPeriodEnd: v.boolean(), // Will cancel at end of period

  // Cancellation tracking
  canceledAt: v.optional(v.number()), // When subscription was canceled (Unix timestamp)
  cancelReason: v.optional(v.string()), // Why subscription was canceled

  // Trial period tracking
  trialStart: v.optional(v.number()), // Trial period start (Unix timestamp)
  trialEnd: v.optional(v.number()), // Trial period end (Unix timestamp)

  // Latest invoice tracking
  latestInvoiceId: v.optional(v.string()), // Stripe invoice ID
  latestInvoiceStatus: v.optional(v.string()), // Invoice status

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_id", ["userId"])
  .index("by_external_customer_id", ["externalCustomerId"])
  .index("by_external_subscription_id", ["externalSubscriptionId"])
  .index("by_status", ["status"]);
