import type { Doc } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export async function resolveSubscriptionPriceByAnyId(
  db: DatabaseReader,
  id: string,
): Promise<Doc<"subscription_prices"> | null> {
  const externallyKeyedPrice = await db
    .query("subscription_prices")
    .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", id))
    .first();
  if (externallyKeyedPrice !== null) {
    return externallyKeyedPrice;
  }

  return await db
    .query("subscription_prices")
    .withIndex("by_vortex_price_id", (q) => q.eq("vortexPriceId", id))
    .first();
}

export async function resolveSubscriptionPriceAndProductByAnyId(
  db: DatabaseReader,
  id: string,
): Promise<{
  readonly price: Doc<"subscription_prices"> | null;
  readonly product: Doc<"subscription_products"> | null;
}> {
  const price = await resolveSubscriptionPriceByAnyId(db, id);
  if (price === null) {
    return { price: null, product: null };
  }

  const product = await db.get(price.subscriptionProductId);
  return { price, product };
}
