/**
 * SUBSCRIPTION PROMO CODES TABLE
 * Promotion codes synced from payment provider - READ-ONLY mirror for fast queries.
 * Source of truth: Payment provider (Stripe).
 * NEVER modify directly - only via payment provider API + webhooks.
 */

import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const subscriptionPromoCodeStatus = v.union(
	v.literal("active"),
	v.literal("inactive"),
	v.literal("expired"),
	v.literal("exhausted"),
	v.literal("deleted"),
);
export type SubscriptionPromoCodeStatus = Infer<
	typeof subscriptionPromoCodeStatus
>;

export const subscriptionPromoCodesTable = defineTable({
	// External IDs (source of truth from payment provider)
	stripePromotionCodeId: v.string(),

	// Reference to coupon
	couponId: v.id("subscription_coupons"),

	// User-facing code
	code: v.string(), // e.g., "SAVE20", "LAUNCH50"

	// Usage limits
	maxRedemptions: v.optional(v.number()), // Max total redemptions (null = unlimited)
	timesRedeemed: v.number(), // Current redemption count
	active: v.boolean(), // Is code currently active

	// Validity period
	expiresAt: v.optional(v.number()), // Unix timestamp (null = no expiry)

	// Customer restriction (from Stripe)
	stripeCustomerId: v.optional(v.string()), // If set, only this customer can use the code

	// Restrictions (from Stripe)
	restrictions: v.optional(
		v.object({
			firstTimeTransaction: v.optional(v.boolean()),
			minimumAmount: v.optional(v.number()), // In cents
			minimumAmountCurrency: v.optional(v.string()),
		}),
	),

	// Metadata (custom fields)
	metadata: v.optional(
		v.object({
			notes: v.optional(v.string()),
			createdBy: v.optional(v.string()),
		}),
	),

	// Timestamps
	createdAt: v.number(),
	updatedAt: v.number(),
	deletedAt: v.optional(v.number()), // Soft delete
})
	.index("by_code", ["code"])
	.index("by_coupon_id", ["couponId"])
	.index("by_expires_at", ["expiresAt"])
	.index("by_stripe_promotion_code_id", ["stripePromotionCodeId"])
	.index("by_deleted_at", ["deletedAt"])
	.index("by_active_deleted_at", ["active", "deletedAt"]);
