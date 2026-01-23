/**
 * Stripe Actions
 *
 * Convex actions for interacting with Stripe API.
 * These run in Node.js runtime and can make external API calls.
 */

import { v } from "convex/values";
import Stripe from "stripe";
import { internalAction } from "../_generated/server";

function initializeStripe(): Stripe {
	const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
	if (!stripeSecretKey) {
		throw new Error("STRIPE_SECRET_KEY not configured");
	}
	return new Stripe(stripeSecretKey, {
		apiVersion: "2025-06-30.basil",
	});
}

/**
 * Retrieve a coupon from Stripe API
 * Used to hydrate coupon data when webhook payload is incomplete
 */
export const retrieveCoupon = internalAction({
	args: {
		couponId: v.string(),
	},
	handler: async (_ctx, { couponId }) => {
		const stripe = initializeStripe();

		try {
			const coupon = await stripe.coupons.retrieve(couponId, {
				expand: ["applies_to"],
			});
			return coupon;
		} catch (error) {
			console.error("Failed to retrieve coupon from Stripe", {
				operation: "retrieveCoupon",
				couponId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	},
});

/**
 * Retrieve a promotion code from Stripe API
 * Used to hydrate promo code data when webhook payload is incomplete
 */
export const retrievePromotionCode = internalAction({
	args: {
		promotionCodeId: v.string(),
	},
	handler: async (_ctx, { promotionCodeId }) => {
		const stripe = initializeStripe();

		try {
			const promotionCode = await stripe.promotionCodes.retrieve(
				promotionCodeId,
				{
					expand: ["coupon"],
				},
			);
			return promotionCode;
		} catch (error) {
			console.error("Failed to retrieve promotion code from Stripe", {
				operation: "retrievePromotionCode",
				promotionCodeId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	},
});
