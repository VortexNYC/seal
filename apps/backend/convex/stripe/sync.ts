/**
 * Stripe Product & Pricing Webhook Sync
 *
 * Keeps the legacy Stripe billing catalog projection current while Seal still
 * accepts Stripe product and price webhooks. Manual acceptance/reconciliation
 * sync entrypoints were removed; this file is not a backfill surface.
 */

import { v } from "convex/values";
import Stripe from "stripe";

import type { ActionCtx } from "../_generated/server";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { syncPrices, syncProduct } from "./sync_helpers";

/**
 * Internal mutation to upsert a product
 */
export const upsertProduct = internalMutation({
  args: {
    externalProductId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
    metadata: v.optional(
      v.object({
        tier: v.optional(v.string()),
        useType: v.optional(v.string()),
        features: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if product already exists
    const existingProduct = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", args.externalProductId))
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
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
    lookupKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if price already exists
    const existingPrice = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", args.externalPriceId))
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
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", args.externalProductId))
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
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", args.externalProductId))
      .first();
  },
});

/**
 * Mark a price status explicitly (e.g., on price.deleted webhook)
 */
export const setPriceStatus = internalMutation({
  args: {
    externalPriceId: v.string(),
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", args.externalPriceId))
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
    apiVersion: "2026-02-25.clover",
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
 * Internal sync function (called by webhooks)
 */
export const syncFromStripeWebhook = internalAction({
  args: {},
  handler: syncFromStripeInternal,
});
