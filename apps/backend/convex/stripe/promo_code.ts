/**
 * Stripe Promo Code Handlers
 *
 * Convex mutations for handling Stripe promotion code webhook events.
 * Processes promo code creation, updates, and deletion.
 */

import { v } from "convex/values";
import type Stripe from "stripe";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

/**
 * Handle promotion_code.created or promotion_code.updated webhook
 * Sync promotion code to Convex (upsert)
 */
export const handlePromotionCodeCreatedOrUpdated = internalMutation({
	args: {
		promotionCode: v.any(), // Stripe.PromotionCode
		coupon: v.any(), // Stripe.Coupon - hydrated coupon data
	},
	handler: async (ctx, { promotionCode, coupon }) => {
		const stripePromoCode = promotionCode as Stripe.PromotionCode;
		const stripeCoupon = coupon as Stripe.Coupon;

		console.info("Processing promotion code webhook", {
			operation: "handlePromotionCodeCreatedOrUpdated",
			promoCodeId: stripePromoCode.id,
			code: stripePromoCode.code,
			active: stripePromoCode.active,
		});

		// First, ensure the coupon exists in our database
		const couponId = await ctx.runMutation(
			internal.stripe.coupon.handleCouponCreatedOrUpdated,
			{ coupon: stripeCoupon },
		);

		// Check if promo code already exists (for updates)
		const existing = await ctx.db
			.query("subscription_promo_codes")
			.withIndex("by_stripe_promotion_code_id", (q) =>
				q.eq("stripePromotionCodeId", stripePromoCode.id),
			)
			.unique();

		const now = Date.now();

		const promoCodeData = {
			stripePromotionCodeId: stripePromoCode.id,
			couponId,
			code: stripePromoCode.code,
			maxRedemptions: stripePromoCode.max_redemptions ?? undefined,
			timesRedeemed: stripePromoCode.times_redeemed,
			active: stripePromoCode.active,
			expiresAt: stripePromoCode.expires_at
				? stripePromoCode.expires_at * 1000
				: undefined,
			stripeCustomerId:
				typeof stripePromoCode.customer === "string"
					? stripePromoCode.customer
					: undefined,
			restrictions: stripePromoCode.restrictions
				? {
						firstTimeTransaction:
							stripePromoCode.restrictions.first_time_transaction,
						minimumAmount:
							stripePromoCode.restrictions.minimum_amount ?? undefined,
						minimumAmountCurrency:
							stripePromoCode.restrictions.minimum_amount_currency ?? undefined,
					}
				: undefined,
			metadata: stripePromoCode.metadata
				? {
						notes: stripePromoCode.metadata.notes ?? undefined,
						createdBy: stripePromoCode.metadata.createdBy ?? undefined,
					}
				: undefined,
			updatedAt: now,
		};

		if (existing) {
			// Update existing promo code
			await ctx.db.patch(existing._id, {
				...promoCodeData,
				deletedAt: undefined, // Restore if previously deleted
			});
			console.info("Updated promo code", {
				promoCodeId: existing._id,
				code: stripePromoCode.code,
			});
		} else {
			// Create new promo code
			const promoCodeDocId = await ctx.db.insert("subscription_promo_codes", {
				...promoCodeData,
				createdAt: now,
			});
			console.info("Created promo code", {
				promoCodeId: promoCodeDocId,
				code: stripePromoCode.code,
			});
		}
	},
});

/**
 * Handle promotion_code.deleted webhook
 * Soft-delete promotion code in Convex
 */
export const handlePromotionCodeDeleted = internalMutation({
	args: {
		promotionCodeId: v.string(), // Stripe promotion code ID
	},
	handler: async (ctx, { promotionCodeId }) => {
		console.info("Processing promotion code deletion", {
			operation: "handlePromotionCodeDeleted",
			promotionCodeId,
		});

		// Find the promo code in our database
		const promoCode = await ctx.db
			.query("subscription_promo_codes")
			.withIndex("by_stripe_promotion_code_id", (q) =>
				q.eq("stripePromotionCodeId", promotionCodeId),
			)
			.unique();

		if (!promoCode) {
			console.info("Promo code not found in database, skipping deletion");
			return;
		}

		const now = Date.now();

		// Soft-delete the promo code (preserve for historical references)
		await ctx.db.patch(promoCode._id, {
			active: false,
			deletedAt: now,
			updatedAt: now,
		});

		console.info("Soft-deleted promo code", {
			promoCodeId: promoCode._id,
			code: promoCode.code,
		});
	},
});
