/**
 * Stripe Coupon Handlers
 *
 * Convex mutations for handling Stripe coupon webhook events.
 * Processes coupon creation, updates, and deletion.
 */

import { v } from "convex/values";
import type Stripe from "stripe";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

/**
 * Handle coupon.deleted webhook
 * Mark all promotion codes using this coupon as inactive and soft-delete the coupon
 */
export const handleCouponDeleted = internalMutation({
	args: {
		couponId: v.string(), // Stripe coupon ID
	},
	handler: async (ctx, { couponId }) => {
		console.info("Processing coupon deletion", {
			operation: "handleCouponDeleted",
			couponId,
		});

		// Find the coupon in our database
		const coupon = await ctx.db
			.query("subscription_coupons")
			.withIndex("by_stripe_coupon_id", (q) => q.eq("stripeCouponId", couponId))
			.unique();

		if (!coupon) {
			console.info("Coupon not found in database, skipping deletion");
			return;
		}

		// Find all promo codes using this coupon
		const promoCodes = await ctx.db
			.query("subscription_promo_codes")
			.withIndex("by_coupon_id", (q) => q.eq("couponId", coupon._id))
			.collect();

		const now = Date.now();

		// Mark them all as inactive and soft-deleted
		for (const promoCode of promoCodes) {
			await ctx.db.patch(promoCode._id, {
				active: false,
				deletedAt: now,
				updatedAt: now,
			});
		}

		// Soft-delete the coupon (preserve for historical references)
		await ctx.db.patch(coupon._id, {
			deletedAt: now,
			updatedAt: now,
		});

		console.info(
			`Soft-deleted ${promoCodes.length} promo codes and coupon for deleted Stripe coupon`,
		);
	},
});

/**
 * Handle coupon.created or coupon.updated webhook
 * Sync coupon to Convex (upsert)
 */
export const handleCouponCreatedOrUpdated = internalMutation({
	args: {
		coupon: v.any(), // Stripe.Coupon
	},
	handler: async (ctx, { coupon }): Promise<Id<"subscription_coupons">> => {
		const stripeCoupon = coupon as Stripe.Coupon;

		console.info("Processing coupon webhook", {
			operation: "handleCouponCreatedOrUpdated",
			couponId: stripeCoupon.id,
			name: stripeCoupon.name,
		});

		// Check if coupon already exists (for updates)
		const existing = await ctx.db
			.query("subscription_coupons")
			.withIndex("by_stripe_coupon_id", (q) =>
				q.eq("stripeCouponId", stripeCoupon.id),
			)
			.unique();

		const now = Date.now();

		const couponData = {
			stripeCouponId: stripeCoupon.id,
			couponType: stripeCoupon.percent_off
				? ("percent_off" as const)
				: ("amount_off" as const),
			percentOff: stripeCoupon.percent_off ?? undefined,
			amountOff: stripeCoupon.amount_off ?? undefined,
			currency: stripeCoupon.currency ?? undefined,
			name: stripeCoupon.name ?? undefined,
			duration: stripeCoupon.duration,
			durationInMonths: stripeCoupon.duration_in_months ?? undefined,
			appliesToProducts: stripeCoupon.applies_to?.products ?? undefined,
			metadata: stripeCoupon.metadata
				? {
						notes: stripeCoupon.metadata.notes ?? undefined,
						createdBy: stripeCoupon.metadata.createdBy ?? undefined,
					}
				: undefined,
			updatedAt: now,
		};

		if (existing) {
			// Update existing coupon
			await ctx.db.patch(existing._id, {
				...couponData,
				deletedAt: undefined, // Restore if previously deleted
			});
			console.info("Updated coupon", {
				couponId: existing._id,
				stripeCouponId: stripeCoupon.id,
			});
			return existing._id;
		}

		// Create new coupon
		const couponId = await ctx.db.insert("subscription_coupons", {
			...couponData,
			createdAt: now,
		});
		console.info("Created coupon", {
			couponId,
			stripeCouponId: stripeCoupon.id,
		});
		return couponId;
	},
});
