/**
 * STRIPE COUPONS TABLE
 * Stripe coupons synced via webhooks - READ-ONLY mirror for fast queries.
 * Source of truth: Stripe coupons.
 * NEVER modify directly - only via Stripe API + webhooks.
 */

import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const stripeCouponType = v.union(
	v.literal("percent_off"),
	v.literal("amount_off"),
);
export type StripeCouponType = Infer<typeof stripeCouponType>;

export const stripeCouponDuration = v.union(
	v.literal("forever"),
	v.literal("once"),
	v.literal("repeating"),
);
export type StripeCouponDuration = Infer<typeof stripeCouponDuration>;

export const stripeCouponsTable = defineTable({
	// Stripe ID (source of truth)
	stripeCouponId: v.string(),

	// Discount details
	couponType: stripeCouponType,
	percentOff: v.optional(v.number()), // For percentage discounts (1-100)
	amountOff: v.optional(v.number()), // For fixed amount discounts (in cents)
	currency: v.optional(v.string()), // For fixed amount (e.g., "usd")

	// Display name
	name: v.optional(v.string()),

	// Duration (how long discount applies)
	duration: stripeCouponDuration,
	durationInMonths: v.optional(v.number()), // For "repeating" duration

	// Product restrictions (which products can use this coupon)
	appliesToProducts: v.optional(v.array(v.string())), // Stripe product IDs

	// Metadata
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
	.index("by_stripe_coupon_id", ["stripeCouponId"])
	.index("by_deleted_at", ["deletedAt"]);
