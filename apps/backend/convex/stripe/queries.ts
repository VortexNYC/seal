/**
 * Stripe Billing Queries
 *
 * Public queries for the billing page:
 * - getSubscriptionDetails: current user's subscription with plan metadata
 * - getAvailablePlans: active products with prices for the upgrade UI
 */

import { query } from "../_generated/server";
import { authQuery } from "../auth/wrappers";

/**
 * Get the current user's subscription details including plan metadata.
 *
 * Joins subscriptions → subscription_prices → subscription_products
 * to resolve tier, features, and credit information.
 */
export const getSubscriptionDetails = authQuery({
	args: {},
	handler: async (ctx) => {
		const userId = ctx.auth.userId;

		// Find the user's active (or most relevant) subscription
		const subscription = await ctx.db
			.query("subscriptions")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.order("desc")
			.first();

		if (!subscription) {
			return null;
		}

		// Look up the price to get product info
		const price = await ctx.db
			.query("subscription_prices")
			.withIndex("by_external_price_id", (q) =>
				q.eq("externalPriceId", subscription.externalPriceId),
			)
			.first();

		let product = null;
		if (price) {
			product = await ctx.db
				.query("subscription_products")
				.withIndex("by_external_product_id", (q) =>
					q.eq("externalProductId", price.externalProductId),
				)
				.first();
		}

		const tier = product?.metadata?.tier ?? "free";
		const features = product?.metadata?.features;

		return {
			status: subscription.status,
			currentPeriodStart: subscription.currentPeriodStart,
			currentPeriodEnd: subscription.currentPeriodEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			canceledAt: subscription.canceledAt,
			trialStart: subscription.trialStart,
			trialEnd: subscription.trialEnd,

			// Plan info
			tier,
			planName: product?.name ?? "Free",
			features: features ?? null,

			// Pricing
			unitAmount: price?.unitAmount ?? 0,
			currency: price?.currency ?? "usd",
			interval: price?.recurring?.interval ?? "month",
			intervalCount: price?.recurring?.intervalCount ?? 1,
		};
	},
});

/**
 * Get available subscription plans for the pricing/upgrade UI.
 *
 * Returns active products with their active prices, sorted by price.
 * This is a public query (no auth required) so unauthenticated
 * pricing pages can use it too.
 */
export const getAvailablePlans = query({
	args: {},
	handler: async (ctx) => {
		const products = await ctx.db
			.query("subscription_products")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();

		const plans = [];

		for (const product of products) {
			const prices = await ctx.db
				.query("subscription_prices")
				.withIndex("by_external_product_id", (q) =>
					q.eq("externalProductId", product.externalProductId),
				)
				.filter((q) => q.eq(q.field("status"), "active"))
				.collect();

			// Separate by interval for monthly/yearly pricing
			const monthlyPrice = prices.find(
				(p) =>
					p.recurring?.interval === "month" &&
					(p.usageType === "licensed" || p.usageType === undefined),
			);
			const yearlyPrice = prices.find(
				(p) =>
					p.recurring?.interval === "year" &&
					(p.usageType === "licensed" || p.usageType === undefined),
			);
			// Fallback: any fixed recurring price
			const fallbackPrice =
				monthlyPrice ??
				yearlyPrice ??
				prices.find(
					(p) => p.usageType === "licensed" || p.usageType === undefined,
				);

			if (!fallbackPrice) {
				continue;
			}

			plans.push({
				productId: product.externalProductId,
				name: product.name,
				description: product.description ?? null,
				tier: product.metadata?.tier ?? null,
				useType: product.metadata?.useType ?? null,
				features: product.metadata?.features ?? null,
				pricing: {
					monthly: monthlyPrice
						? {
								amount: monthlyPrice.unitAmount
									? monthlyPrice.unitAmount / 100
									: 0,
								currency: monthlyPrice.currency,
								lookupKey: monthlyPrice.lookupKey ?? null,
							}
						: null,
					yearly: yearlyPrice
						? {
								amount: yearlyPrice.unitAmount
									? yearlyPrice.unitAmount / 100
									: 0,
								currency: yearlyPrice.currency,
								lookupKey: yearlyPrice.lookupKey ?? null,
							}
						: null,
				},
			});
		}

		// Sort by cheapest monthly price first
		plans.sort((a, b) => {
			const aPrice = a.pricing.monthly?.amount ?? a.pricing.yearly?.amount ?? 0;
			const bPrice = b.pricing.monthly?.amount ?? b.pricing.yearly?.amount ?? 0;
			return aPrice - bPrice;
		});

		return plans;
	},
});
