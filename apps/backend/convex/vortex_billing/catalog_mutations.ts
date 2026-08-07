import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

const productStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("deleted")
);

const priceStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("deleted")
);

const productMetadataValidator = v.object({
  tier: v.optional(v.string()),
  useType: v.optional(v.string()),
  features: v.optional(v.string()),
});

export const upsertProductByVortexId = internalMutation({
  args: {
    vortexProductId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: productStatusValidator,
    metadata: v.optional(productMetadataValidator),
  },
  returns: v.object({
    action: v.union(v.literal("created"), v.literal("updated")),
    subscriptionProductId: v.id("subscription_products"),
    vortexProductId: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingProduct = await ctx.db
      .query("subscription_products")
      .withIndex("by_vortex_product_id", (q) =>
        q.eq("vortexProductId", args.vortexProductId)
      )
      .first();

    if (existingProduct !== null) {
      await ctx.db.patch("subscription_products", existingProduct._id, {
        vortexProductId: args.vortexProductId,
        name: args.name,
        description: args.description,
        status: args.status,
        metadata: args.metadata,
        updatedAt: now,
      });
      return {
        action: "updated" as const,
        subscriptionProductId: existingProduct._id,
        vortexProductId: args.vortexProductId,
      };
    }

    const subscriptionProductId = await ctx.db.insert("subscription_products", {
      externalProductId: args.vortexProductId,
      vortexProductId: args.vortexProductId,
      name: args.name,
      description: args.description,
      status: args.status,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return {
      action: "created" as const,
      subscriptionProductId,
      vortexProductId: args.vortexProductId,
    };
  },
});

export const upsertPriceByVortexId = internalMutation({
  args: {
    vortexPriceId: v.string(),
    vortexProductId: v.string(),
    subscriptionProductId: v.id("subscription_products"),
    type: v.union(v.literal("recurring"), v.literal("one_time")),
    billingScheme: v.union(v.literal("per_unit"), v.literal("tiered")),
    currency: v.string(),
    recurring: v.optional(
      v.object({
        interval: v.string(),
        intervalCount: v.number(),
      })
    ),
    unitAmount: v.optional(v.number()),
    usageType: v.optional(v.string()),
    status: priceStatusValidator,
    lookupKey: v.optional(v.string()),
  },
  returns: v.object({
    action: v.union(v.literal("created"), v.literal("updated")),
    subscriptionPriceId: v.id("subscription_prices"),
    vortexPriceId: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingPrice = await ctx.db
      .query("subscription_prices")
      .withIndex("by_vortex_price_id", (q) =>
        q.eq("vortexPriceId", args.vortexPriceId)
      )
      .first();

    if (existingPrice !== null) {
      await ctx.db.patch("subscription_prices", existingPrice._id, {
        vortexPriceId: args.vortexPriceId,
        externalProductId: args.vortexProductId,
        subscriptionProductId: args.subscriptionProductId,
        type: args.type,
        billingScheme: args.billingScheme,
        currency: args.currency,
        recurring: args.recurring,
        unitAmount: args.unitAmount,
        usageType: args.usageType,
        status: args.status,
        lookupKey: args.lookupKey,
        updatedAt: now,
      });
      return {
        action: "updated" as const,
        subscriptionPriceId: existingPrice._id,
        vortexPriceId: args.vortexPriceId,
      };
    }

    const subscriptionPriceId = await ctx.db.insert("subscription_prices", {
      externalPriceId: args.vortexPriceId,
      vortexPriceId: args.vortexPriceId,
      externalProductId: args.vortexProductId,
      subscriptionProductId: args.subscriptionProductId,
      type: args.type,
      billingScheme: args.billingScheme,
      currency: args.currency,
      recurring: args.recurring,
      unitAmount: args.unitAmount,
      usageType: args.usageType,
      status: args.status,
      lookupKey: args.lookupKey,
      createdAt: now,
      updatedAt: now,
    });

    return {
      action: "created" as const,
      subscriptionPriceId,
      vortexPriceId: args.vortexPriceId,
    };
  },
});
