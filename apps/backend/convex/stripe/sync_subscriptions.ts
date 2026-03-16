/**
 * Sync Stripe Subscriptions
 *
 * Reconciliation script to sync active Stripe subscriptions into Convex.
 * Handles cases where webhook delivery failed (e.g., missing metadata)
 * and Convex doesn't have the subscription record.
 *
 * Usage:
 *   npx convex run stripe/sync_subscriptions:syncStripeSubscriptions
 *
 * This script is idempotent — it skips subscriptions already in Convex.
 */

import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Get all users who have a Stripe customer ID, along with their
 * existing Convex subscription external IDs for dedup.
 */
export const getUsersWithStripeCustomers = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      userId: Id<"users">;
      email: string;
      stripeCustomerId: string;
      existingSubscriptionIds: string[];
    }>
  > => {
    const allUsers = await ctx.db.query("users").collect();

    const results: Array<{
      userId: Id<"users">;
      email: string;
      stripeCustomerId: string;
      existingSubscriptionIds: string[];
    }> = [];

    for (const user of allUsers) {
      if (!user.stripeCustomerId) {
        continue;
      }

      // TODO: rewrite for org-scoped subscriptions
      // The old user-scoped by_user_id index has been removed.
      // This sync script needs to query by org or by external customer ID instead.
      const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_external_customer_id", (q) => q.eq("externalCustomerId", user.stripeCustomerId!))
        .collect();

      results.push({
        userId: user._id,
        email: user.email,
        stripeCustomerId: user.stripeCustomerId,
        existingSubscriptionIds: subscriptions.map((s) => s.externalSubscriptionId),
      });
    }

    return results;
  },
});

interface SyncResult {
  total: number;
  synced: number;
  alreadyInConvex: number;
  skippedInactive: number;
  errors: number;
}

/**
 * Sync active Stripe subscriptions into Convex for all users.
 *
 * For each user with a Stripe customer ID:
 * 1. Lists their Stripe subscriptions
 * 2. For any active/trialing subscription not in Convex, creates the record
 * 3. Updates subscription metadata with userId if missing (prevents future webhook failures)
 *
 * Safe to run multiple times — fully idempotent.
 */
export const syncStripeSubscriptions = internalAction({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    const stripe = initializeStripe();

    const users = await ctx.runMutation(
      internal.stripe.sync_subscriptions.getUsersWithStripeCustomers,
      {},
    );

    console.warn(`Found ${users.length} users with Stripe customer IDs`);

    let synced = 0;
    let alreadyInConvex = 0;
    let skippedInactive = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          limit: 100,
        });

        for (const sub of stripeSubscriptions.data) {
          // Skip terminal statuses
          if (sub.status === "canceled" || sub.status === "incomplete_expired") {
            skippedInactive++;
            continue;
          }

          // Already in Convex?
          if (user.existingSubscriptionIds.includes(sub.id)) {
            alreadyInConvex++;
            continue;
          }

          // Ensure subscription has userId in metadata (fix for future webhooks)
          if (!sub.metadata?.userId) {
            await stripe.subscriptions.update(sub.id, {
              metadata: {
                ...sub.metadata,
                userId: user.userId,
              },
            });
            console.warn(`[FIX] Added userId metadata to Stripe subscription ${sub.id}`);
          }

          // Get price ID from first item
          const firstItem = sub.items.data[0];
          if (!firstItem) {
            console.error(`[ERROR] Subscription ${sub.id} has no items, skipping`);
            errors++;
            continue;
          }

          const currentPeriodStart = firstItem.current_period_start;
          const currentPeriodEnd = firstItem.current_period_end;

          if (!currentPeriodStart || !currentPeriodEnd) {
            console.error(`[ERROR] Subscription ${sub.id} missing period dates, skipping`);
            errors++;
            continue;
          }

          await ctx.runMutation(internal.stripe.subscription_actions.createSubscriptionRecord, {
            userId: user.userId,
            stripeCustomerId: user.stripeCustomerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: firstItem.price.id,
            status: sub.status,
            currentPeriodStart: currentPeriodStart * 1000,
            currentPeriodEnd: currentPeriodEnd * 1000,
          });

          synced++;
          console.warn(
            `[SYNCED] ${user.email}: subscription ${sub.id} (${sub.status}, price: ${firstItem.price.id})`,
          );
        }
      } catch (err) {
        errors++;
        console.error(
          `[ERROR] Failed to sync ${user.email} (${user.stripeCustomerId}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const summary: SyncResult = {
      total: users.length,
      synced,
      alreadyInConvex,
      skippedInactive,
      errors,
    };

    console.warn("Subscription sync complete:", JSON.stringify(summary, null, 2));
    return summary;
  },
});
