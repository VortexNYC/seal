/**
 * SUBSCRIPTIONS TABLE
 * Subscription data for organizations.
 * Synced via Vortex Billing webhooks.
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
  // TODO: Narrow back to v.id("organizations") and remove userId after backfill migration runs
  organizationId: v.optional(v.id("organizations")),
  userId: v.optional(v.id("users")), // Legacy field — remove after migration

  externalCustomerId: v.string(), // Billing customer ID
  externalSubscriptionId: v.string(), // Billing subscription ID
  externalPriceId: v.string(), // Billing price ID (base subscription)
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
  latestInvoiceId: v.optional(v.string()), // Billing invoice ID
  latestInvoiceStatus: v.optional(v.string()), // Invoice status
  pastDueSince: v.optional(v.number()), // When subscription most recently entered past_due (epoch ms)
  lastSourceEventAt: v.optional(v.number()), // Last applied Vortex source event timestamp (ms)

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization_id", ["organizationId"])
  .index("by_organization_status", ["organizationId", "status"])
  .index("by_external_customer_id", ["externalCustomerId"])
  .index("by_external_subscription_id", ["externalSubscriptionId"])
  .index("by_status", ["status"]);
