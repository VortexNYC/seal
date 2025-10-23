/**
 * SUBSCRIPTIONS TABLE
 * Stripe subscription data for users.
 * Synced via Stripe webhooks - source of truth for user credits.
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
	externalOveragePriceId: v.optional(v.string()), // Stripe price ID for overage
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

	// Credit balances (hybrid billing) - TEMPORARY: optional during migration
	creditsIncluded: v.optional(v.number()), // Monthly allocation from subscription
	creditsUsed: v.optional(v.number()), // Total credits used this billing cycle
	creditsRemaining: v.optional(v.number()), // Included credits remaining
	topupCreditsRemaining: v.optional(v.number()), // Non-expiring top-up credits

	// Overage settings
	overageEnabled: v.optional(v.boolean()), // User consent for overage billing
	overageLimit: v.optional(v.number()), // Max overage credits per cycle
	overageConsentTimestamp: v.optional(v.number()), // When user consented
	overageUsedThisCycle: v.optional(v.number()), // Overage credits used this cycle

	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_user_id", ["userId"])
	.index("by_external_customer_id", ["externalCustomerId"])
	.index("by_external_subscription_id", ["externalSubscriptionId"])
	.index("by_status", ["status"]);
