/**
 * Stripe Product & Pricing Sync
 *
 * Syncs products, prices, and features from Stripe to Convex.
 * This eliminates the need for hardcoded price IDs in environment variables.
 *
 * Usage:
 * 1. Set price metadata in Stripe with: tier, documentsPerMonth, maxRecipients
 * 2. Attach features to products via Stripe Entitlements
 * 3. Run: bunx convex run stripe/sync:syncFromStripe
 * 4. Products, prices, and features will be stored in Convex
 */

import { v } from "convex/values";
import Stripe from "stripe";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
} from "../_generated/server";
import { syncPrices, syncProduct } from "./sync_helpers";

/**
 * Internal mutation to upsert a product
 */
export const upsertProduct = internalMutation({
	args: {
		externalProductId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		status: v.union(
			v.literal("active"),
			v.literal("archived"),
			v.literal("deleted"),
		),
		metadata: v.optional(
			v.object({
				tier: v.optional(v.string()),
				useType: v.optional(v.string()),
				features: v.optional(v.string()),
				includedCredits: v.optional(v.number()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// Check if product already exists
		const existingProduct = await ctx.db
			.query("subscription_products")
			.withIndex("by_external_product_id", (q) =>
				q.eq("externalProductId", args.externalProductId),
			)
			.first();

		if (existingProduct) {
			// Update existing product
			await ctx.db.patch(existingProduct._id, {
				...args,
				updatedAt: now,
			});
			return { action: "updated", name: args.name };
		} else {
			// Insert new product
			await ctx.db.insert("subscription_products", {
				...args,
				createdAt: now,
				updatedAt: now,
			});
			return { action: "created", name: args.name };
		}
	},
});

/**
 * Internal mutation to upsert a price
 */
export const upsertPrice = internalMutation({
	args: {
		externalPriceId: v.string(),
		externalProductId: v.string(),
		subscriptionProductId: v.id("subscription_products"),
		type: v.union(v.literal("recurring"), v.literal("one_time")),
		billingScheme: v.union(v.literal("per_unit"), v.literal("tiered")),
		currency: v.string(),
		recurring: v.optional(
			v.object({
				interval: v.string(),
				intervalCount: v.number(),
			}),
		),
		unitAmount: v.optional(v.number()),
		usageType: v.optional(v.string()),
		status: v.union(
			v.literal("active"),
			v.literal("archived"),
			v.literal("deleted"),
		),
		lookupKey: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// Check if price already exists
		const existingPrice = await ctx.db
			.query("subscription_prices")
			.withIndex("by_external_price_id", (q) =>
				q.eq("externalPriceId", args.externalPriceId),
			)
			.first();

		if (existingPrice) {
			// Update existing price
			await ctx.db.patch(existingPrice._id, {
				...args,
				updatedAt: now,
			});
			return {
				action: "updated",
				id: args.externalPriceId,
				amount: args.unitAmount,
			};
		} else {
			// Insert new price
			await ctx.db.insert("subscription_prices", {
				...args,
				createdAt: now,
				updatedAt: now,
			});
			return {
				action: "created",
				id: args.externalPriceId,
				amount: args.unitAmount,
			};
		}
	},
});

/**
 * Mark a product status explicitly (e.g., on product.deleted webhook)
 */
export const setProductStatus = internalMutation({
	args: {
		externalProductId: v.string(),
		status: v.union(
			v.literal("active"),
			v.literal("archived"),
			v.literal("deleted"),
		),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("subscription_products")
			.withIndex("by_external_product_id", (q) =>
				q.eq("externalProductId", args.externalProductId),
			)
			.first();

		if (!existing) return { updated: false } as const;

		await ctx.db.patch(existing._id, {
			status: args.status,
			updatedAt: Date.now(),
		});

		return { updated: true } as const;
	},
});

/**
 * Internal query to get product by external ID
 */
export const getProductByExternalId = internalQuery({
	args: {
		externalProductId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("subscription_products")
			.withIndex("by_external_product_id", (q) =>
				q.eq("externalProductId", args.externalProductId),
			)
			.first();
	},
});

/**
 * Mark a price status explicitly (e.g., on price.deleted webhook)
 */
export const setPriceStatus = internalMutation({
	args: {
		externalPriceId: v.string(),
		status: v.union(
			v.literal("active"),
			v.literal("archived"),
			v.literal("deleted"),
		),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("subscription_prices")
			.withIndex("by_external_price_id", (q) =>
				q.eq("externalPriceId", args.externalPriceId),
			)
			.first();

		if (!existing) return { updated: false } as const;

		await ctx.db.patch(existing._id, {
			status: args.status,
			updatedAt: Date.now(),
		});

		return { updated: true } as const;
	},
});

/**
 * Internal sync function (called by webhooks or manually)
 */
const syncFromStripeInternal = async (ctx: ActionCtx) => {
	const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
	if (!stripeSecretKey) {
		throw new Error("STRIPE_SECRET_KEY not configured");
	}

	const stripe = new Stripe(stripeSecretKey, {
		apiVersion: "2025-12-15.clover",
	});

	// Fetch and sync all products from Stripe with pagination (active and archived)
	let startingAfter: string | undefined;
	let syncedProducts = 0;
	let failedProducts = 0;

	while (true) {
		const params: Stripe.ProductListParams = {
			expand: ["data.default_price"],
			limit: 100,
		};
		if (startingAfter) params.starting_after = startingAfter;

		const page = await stripe.products.list(params);
		if (page.data.length === 0) break;

		for (const product of page.data) {
			// Upsert product (status derived from product.active)
			const productResult = await syncProduct(ctx, product);

			if (productResult.action === "failed") {
				failedProducts++;
				continue;
			}

			syncedProducts++;
			console.warn(
				`${productResult.action === "created" ? "Created" : "Updated"} product: ${productResult.name}`,
			);

			// Sync all prices for this product (includes archived)
			await syncPrices(ctx, stripe, product.id, product.name);
		}

		if (!page.has_more) break;
		const lastItem = page.data[page.data.length - 1];
		if (!lastItem) break;
		startingAfter = lastItem.id;
	}

	const hasFailures = failedProducts > 0;
	const failureSummary = hasFailures ? ` (${failedProducts} failed)` : "";

	console.warn(
		`${hasFailures ? "⚠" : "✓"} Stripe sync complete! Synced ${syncedProducts} products${failureSummary}`,
	);

	return {
		success: !hasFailures,
		syncedProducts,
		failedProducts,
	};
};

/**
 * Sync products and prices from Stripe to Convex (manual call)
 *
 * Run this manually: bunx convex run stripeSync:syncFromStripe
 */
export const syncFromStripe = action({
	args: {},
	handler: syncFromStripeInternal,
});

/**
 * Internal sync function (called by webhooks)
 */
export const syncFromStripeWebhook = internalAction({
	args: {},
	handler: syncFromStripeInternal,
});

/**
 * Get subscription plans with their pricing
 *
 * Returns active products with their fixed and metered prices.
 * Used by frontend to display pricing options.
 */
export const getSubscriptionPlans = internalMutation({
	args: {},
	handler: async (ctx) => {
		// Get all active products
		const products = await ctx.db
			.query("subscription_products")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();

		const plans = [];

		for (const product of products) {
			// Get prices for this product
			const prices = await ctx.db
				.query("subscription_prices")
				.withIndex("by_external_product_id", (q) =>
					q.eq("externalProductId", product.externalProductId),
				)
				.filter((q) => q.eq(q.field("status"), "active"))
				.collect();

			// Find fixed (licensed) and metered prices
			const fixedPrice = prices.find(
				(p) => p.usageType === "licensed" || p.usageType === undefined,
			);
			const meteredPrice = prices.find((p) => p.usageType === "metered");

			if (!fixedPrice) {
				console.warn(`No fixed price found for product ${product.name}`);
				continue;
			}

			plans.push({
				productId: product.externalProductId,
				name: product.name,
				description: product.description,
				tier: product.metadata?.tier,
				includedCredits: product.metadata?.includedCredits || 0,
				features: product.metadata?.features || [],
				pricing: {
					monthly: fixedPrice.unitAmount ? fixedPrice.unitAmount / 100 : 0,
					currency: fixedPrice.currency,
					fixedPriceId: fixedPrice.externalPriceId,
					meteredPriceId: meteredPrice?.externalPriceId,
					overageRate: meteredPrice?.unitAmount
						? meteredPrice.unitAmount / 100
						: 0,
				},
			});
		}

		// Sort by price (lowest to highest)
		plans.sort((a, b) => a.pricing.monthly - b.pricing.monthly);

		return plans;
	},
});

/**
 * Admin: Get full Stripe catalog with statuses
 * Returns all products and their prices, regardless of status
 */
export const getStripeCatalogDetailed = internalMutation({
	args: {},
	handler: async (ctx) => {
		const products = await ctx.db.query("subscription_products").collect();
		const result: Array<{
			product: Doc<"subscription_products">;
			prices: Doc<"subscription_prices">[];
		}> = [];

		for (const product of products) {
			const prices = await ctx.db
				.query("subscription_prices")
				.withIndex("by_external_product_id", (q) =>
					q.eq("externalProductId", product.externalProductId),
				)
				.collect();
			result.push({ product, prices });
		}

		return result;
	},
});
