/**
 * Backfill Free Subscriptions
 *
 * One-off script to ensure all existing users have a Stripe subscription.
 * Users without an active/trialing subscription get enrolled to the default free plan.
 *
 * Usage:
 *   npx convex run stripe/backfill_subscriptions:backfillFreeSubscriptions
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY must be set
 *   - DEFAULT_PLAN_LOOKUP_KEY must be set (e.g., "free:personal:monthly:v1")
 *   - The free plan product and price must be synced in Convex
 *
 * This script is idempotent — it skips users who already have subscriptions
 * and uses Stripe idempotency keys to prevent duplicate charges.
 */

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";

/**
 * Find all users who do not have an active or trialing subscription.
 * Returns their user IDs for the backfill action to process.
 */
export const getUsersWithoutSubscription = internalMutation({
  args: {},
  handler: async (ctx): Promise<Array<{ userId: Id<"users">; email: string; name?: string }>> => {
    const allUsers = await ctx.db.query("users").collect();

    const usersWithoutSub: Array<{
      userId: Id<"users">;
      email: string;
      name?: string;
    }> = [];

    for (const user of allUsers) {
      // Check if this user has any non-terminal subscription
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .filter((q) => q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing")))
        .first();

      if (!subscription) {
        usersWithoutSub.push({
          userId: user._id,
          email: user.email,
          name: user.name,
        });
      }
    }

    return usersWithoutSub;
  },
});

/**
 * Backfill free subscriptions for all users who don't have one.
 *
 * This action:
 * 1. Finds all users without an active/trialing subscription
 * 2. For each, calls subscribeUserToDefaultPlan (which handles Stripe customer
 *    creation, duplicate checks, and subscription creation)
 * 3. Logs results for each user
 *
 * Safe to run multiple times — fully idempotent.
 */
interface BackfillResult {
  total: number;
  created: number;
  alreadySubscribed: number;
  skipped: number;
  errors: number;
}

export const backfillFreeSubscriptions = internalAction({
  args: {},
  handler: async (ctx): Promise<BackfillResult> => {
    const usersWithoutSub: Array<{
      userId: Id<"users">;
      email: string;
      name?: string;
    }> = await ctx.runMutation(
      internal.stripe.backfill_subscriptions.getUsersWithoutSubscription,
      {},
    );

    console.warn(`Found ${usersWithoutSub.length} users without an active subscription`);

    if (usersWithoutSub.length === 0) {
      console.warn("Nothing to backfill — all users have subscriptions.");
      return {
        total: 0,
        created: 0,
        alreadySubscribed: 0,
        skipped: 0,
        errors: 0,
      };
    }

    let created = 0;
    let alreadySubscribed = 0;
    let skipped = 0;
    let errors = 0;

    for (const { userId, email } of usersWithoutSub) {
      try {
        const result = await ctx.runAction(
          internal.stripe.subscription_actions.subscribeUserToDefaultPlan,
          { userId },
        );

        switch (result.status) {
          case "subscription_created":
            created++;
            console.warn(
              `[OK] Created subscription for ${email} (${userId}): ${result.stripeSubscriptionId}`,
            );
            break;
          case "already_subscribed":
            alreadySubscribed++;
            console.warn(
              `[SKIP] ${email} (${userId}) already has subscription ${result.subscriptionId}`,
            );
            break;
          case "skipped":
            skipped++;
            console.warn(`[SKIP] ${email} (${userId}): ${result.reason}`);
            break;
          case "error":
            errors++;
            console.error(`[ERROR] ${email} (${userId}): ${result.error}`);
            break;
        }
      } catch (err) {
        errors++;
        console.error(
          `[ERROR] Failed to process ${email} (${userId}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const summary: BackfillResult = {
      total: usersWithoutSub.length,
      created,
      alreadySubscribed,
      skipped,
      errors,
    };

    console.warn("Backfill complete:", JSON.stringify(summary, null, 2));
    return summary;
  },
});
