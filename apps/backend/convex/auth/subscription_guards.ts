/**
 * Subscription Guard Helpers
 *
 * Plain helper functions for enforcing subscription plan limits.
 * These are NOT Convex functions — they accept `ctx.db` directly
 * and are meant to be called inside mutations/queries.
 */

import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";

/**
 * Plan limits for Free and Pro tiers
 */
export const PLAN_LIMITS = {
  free: {
    documentsPerMonth: 10,
    storageBytes: 100 * 1024 * 1024, // 100 MB
  },
  pro: {
    documentsPerMonth: 500,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
  },
} as const;

/**
 * Determine the user's current subscription plan.
 *
 * Treats `"active"` and `"trialing"` statuses as Pro.
 */
export async function getSubscriptionPlan(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<{ isPro: boolean; plan: "free" | "pro" }> {
  const subscription = await db
    .query("subscriptions")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .order("desc")
    .first();

  if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) {
    return { isPro: false, plan: "free" };
  }

  // Resolve the tier by joining through price → product
  const price = await db
    .query("subscription_prices")
    .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", subscription.externalPriceId))
    .first();

  let tier: string | undefined;
  if (price) {
    const product = await db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) =>
        q.eq("externalProductId", price.externalProductId),
      )
      .first();
    tier = product?.metadata?.tier;
  }

  const isPro = tier === "pro";
  return { isPro, plan: isPro ? "pro" : "free" };
}

/**
 * Throw if the user is not on a Pro plan.
 *
 * Error message intentionally contains "Pro plan" and "upgrade"
 * so `parseConvexError()` classifies it as a subscription error.
 */
export async function ensureProFeature(
  db: DatabaseReader,
  userId: Id<"users">,
  featureName: string,
): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, userId);
  if (!isPro) {
    throw new ConvexError(`${featureName} requires a Pro plan. Please upgrade to continue.`);
  }
}

/**
 * Throw if the user has reached their monthly document creation limit.
 */
export async function ensureDocumentLimit(db: DatabaseReader, userId: Id<"users">): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, userId);
  const limit = isPro ? PLAN_LIMITS.pro.documentsPerMonth : PLAN_LIMITS.free.documentsPerMonth;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthTimestamp = startOfMonth.getTime();

  const documents = await db
    .query("documents")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();

  const documentsThisMonth = documents.filter(
    (doc) => doc.status !== "deleted" && doc.createdAt >= startOfMonthTimestamp,
  );

  if (documentsThisMonth.length >= limit) {
    throw new ConvexError(
      `You've reached your monthly document limit (${documentsThisMonth.length}/${limit}). ` +
        (isPro
          ? "Please contact support to increase your limit."
          : "Please upgrade to the Pro plan for up to 500 documents per month."),
    );
  }
}

/**
 * Throw if adding `additionalBytes` would exceed the user's storage limit.
 */
export async function ensureStorageLimit(
  db: DatabaseReader,
  userId: Id<"users">,
  additionalBytes: number,
): Promise<void> {
  const { isPro } = await getSubscriptionPlan(db, userId);
  const limit = isPro ? PLAN_LIMITS.pro.storageBytes : PLAN_LIMITS.free.storageBytes;

  const documents = await db
    .query("documents")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();

  const totalBytes = documents
    .filter((doc) => doc.status !== "deleted")
    .reduce((sum, doc) => sum + (doc.fileSize || 0), 0);

  if (totalBytes + additionalBytes > limit) {
    const usedMB = Math.round(totalBytes / (1024 * 1024));
    const limitMB = Math.round(limit / (1024 * 1024));
    throw new ConvexError(
      `Storage limit exceeded (${usedMB} MB / ${limitMB} MB used). ` +
        (isPro
          ? "Please contact support to increase your storage."
          : "Please upgrade to the Pro plan for up to 10 GB of storage."),
    );
  }
}
