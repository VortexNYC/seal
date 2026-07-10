/**
 * SUBSCRIPTION COUPONS TABLE
 * Coupons synced from Vortex Billing - READ-ONLY mirror for fast queries.
 * Source of truth: Vortex Billing.
 * NEVER modify directly - only via Vortex Billing API + webhooks.
 */

import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const subscriptionCouponType = v.union(v.literal("percent_off"), v.literal("amount_off"));
export type SubscriptionCouponType = Infer<typeof subscriptionCouponType>;

export const subscriptionCouponDuration = v.union(
  v.literal("forever"),
  v.literal("once"),
  v.literal("repeating"),
);
export type SubscriptionCouponDuration = Infer<typeof subscriptionCouponDuration>;

export const subscriptionCouponsTable = defineTable({
  // Provider coupon ID
  providerCouponId: v.string(),

  // Discount details
  couponType: subscriptionCouponType,
  percentOff: v.optional(v.number()), // For percentage discounts (1-100)
  amountOff: v.optional(v.number()), // For fixed amount discounts (in cents)
  currency: v.optional(v.string()), // For fixed amount (e.g., "usd")

  // Display name
  name: v.optional(v.string()),

  // Duration (how long discount applies)
  duration: subscriptionCouponDuration,
  durationInMonths: v.optional(v.number()), // For "repeating" duration

  // Product restrictions (which products can use this coupon)
  appliesToProducts: v.optional(v.array(v.string())), // Vortex product IDs

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
  .index("by_provider_coupon", ["providerCouponId"])
  .index("by_deleted_at", ["deletedAt"]);
