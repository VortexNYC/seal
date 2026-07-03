import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { resolveSubscriptionPriceAndProductByAnyId } from "../subscription_price_resolver";

export const getSubscriptionPriceByAnyId = internalQuery({
  args: {
    id: v.string(),
  },
  returns: v.union(
    v.object({
      subscriptionPriceId: v.id("subscription_prices"),
      subscriptionProductId: v.id("subscription_products"),
      externalPriceId: v.string(),
      vortexPriceId: v.optional(v.string()),
      externalProductId: v.string(),
      vortexProductId: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
      unitAmount: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const { price, product } = await resolveSubscriptionPriceAndProductByAnyId(ctx.db, args.id);
    if (price === null) {
      return null;
    }

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
  },
});
