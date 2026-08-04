import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { resolveSubscriptionPriceAndProductByAnyId } from "../subscription_price_resolver";

const subscriptionPriceResultValidator = v.object({
  subscriptionPriceId: v.id("subscription_prices"),
  subscriptionProductId: v.id("subscription_products"),
  externalPriceId: v.string(),
  vortexPriceId: v.optional(v.string()),
  externalProductId: v.string(),
  vortexProductId: v.optional(v.string()),
  status: v.union(
    v.literal("active"),
    v.literal("archived"),
    v.literal("deleted")
  ),
  unitAmount: v.optional(v.number()),
});

type SubscriptionPriceResult = {
  readonly subscriptionPriceId: Doc<"subscription_prices">["_id"];
  readonly subscriptionProductId: Doc<"subscription_products">["_id"];
  readonly externalPriceId: string;
  readonly vortexPriceId?: string;
  readonly externalProductId: string;
  readonly vortexProductId?: string;
  readonly status: "active" | "archived" | "deleted";
  readonly unitAmount?: number;
};

function serializeSubscriptionPrice(
  price: Doc<"subscription_prices">,
  product: Doc<"subscription_products"> | null
): SubscriptionPriceResult {
  return {
    subscriptionPriceId: price._id,
    subscriptionProductId: price.subscriptionProductId,
    externalPriceId: price.externalPriceId,
    vortexPriceId: price.vortexPriceId,
    externalProductId: price.externalProductId,
    vortexProductId: product?.vortexProductId,
    status: price.status,
    unitAmount: price.unitAmount,
  };
}

export const getSubscriptionPriceByAnyId = internalQuery({
  args: {
    id: v.string(),
  },
  returns: v.union(subscriptionPriceResultValidator, v.null()),
  handler: async (ctx, args): Promise<SubscriptionPriceResult | null> => {
    const { price, product } = await resolveSubscriptionPriceAndProductByAnyId(
      ctx.db,
      args.id
    );
    if (price === null) {
      return null;
    }

    return serializeSubscriptionPrice(price, product);
  },
});

export const getActiveVortexSubscriptionPriceByLookupKey = internalQuery({
  args: {
    lookupKey: v.string(),
  },
  returns: v.union(subscriptionPriceResultValidator, v.null()),
  handler: async (ctx, args): Promise<SubscriptionPriceResult | null> => {
    const prices = await ctx.db
      .query("subscription_prices")
      .withIndex("by_lookup_key", (q) => q.eq("lookupKey", args.lookupKey))
      .take(20);
    const activeVortexPrices = prices.filter(
      (price) => price.status === "active" && price.vortexPriceId !== undefined
    );

    if (activeVortexPrices.length === 0) {
      return null;
    }
    if (activeVortexPrices.length > 1) {
      throw new ConvexError(
        `Multiple active Vortex subscription prices found for lookupKey: ${args.lookupKey}`
      );
    }

    const price = activeVortexPrices[0];
    const product = await ctx.db.get(price.subscriptionProductId);
    return serializeSubscriptionPrice(price, product);
  },
});
