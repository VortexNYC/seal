/**
 * Sync Stripe Subscriptions
 *
 * Reconciliation script to sync active Stripe subscriptions into Convex.
 * Queries organizations (not users) for stripeCustomerId.
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
    apiVersion: "2026-02-25.clover",
  });
}

/**
 * Get all organizations with a Stripe customer ID, plus their
 * existing Convex subscription IDs for dedup.
 */
export const getOrgsWithStripeCustomers = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      organizationId: Id<"organizations">;
      name: string;
      stripeCustomerId: string;
      existingSubscriptionIds: string[];
    }>
  > => {
    const allOrgs = await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer_id")
      .collect();

    const results = [];
    for (const org of allOrgs) {
      if (!org.stripeCustomerId) continue;

      const subs = await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", org._id))
        .collect();

      results.push({
        organizationId: org._id,
        name: org.name || "",
        stripeCustomerId: org.stripeCustomerId,
        existingSubscriptionIds: subs.map((s) => s.externalSubscriptionId),
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
 * Sync active Stripe subscriptions into Convex for all organizations.
 *
 * For each org with a Stripe customer ID:
 * 1. Lists their Stripe subscriptions
 * 2. For any active/trialing subscription not in Convex, creates the record
 *
 * Safe to run multiple times — fully idempotent.
 */
export const syncStripeSubscriptions = internalAction({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    const stripe = initializeStripe();

    const orgs = await ctx.runMutation(
      internal.stripe.sync_subscriptions.getOrgsWithStripeCustomers,
      {},
    );

    console.warn(`Found ${orgs.length} organizations with Stripe customer IDs`);

    let synced = 0;
    let alreadyInConvex = 0;
    let skippedInactive = 0;
    let errors = 0;

    for (const org of orgs) {
      try {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: org.stripeCustomerId,
          limit: 100,
        });

        for (const sub of stripeSubscriptions.data) {
          if (sub.status === "canceled" || sub.status === "incomplete_expired") {
            skippedInactive++;
            continue;
          }

          if (org.existingSubscriptionIds.includes(sub.id)) {
            alreadyInConvex++;
            continue;
          }

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
            organizationId: org.organizationId,
            stripeCustomerId: org.stripeCustomerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: firstItem.price.id,
            status: sub.status,
            currentPeriodStart: currentPeriodStart * 1000,
            currentPeriodEnd: currentPeriodEnd * 1000,
          });

          synced++;
          console.warn(
            `[SYNCED] ${org.name}: subscription ${sub.id} (${sub.status}, price: ${firstItem.price.id})`,
          );
        }
      } catch (err) {
        errors++;
        console.error(
          `[ERROR] Failed to sync ${org.name} (${org.stripeCustomerId}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const summary: SyncResult = {
      total: orgs.length,
      synced,
      alreadyInConvex,
      skippedInactive,
      errors,
    };

    console.warn("Subscription sync complete:", JSON.stringify(summary, null, 2));
    return summary;
  },
});
