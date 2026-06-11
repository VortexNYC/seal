/**
 * External Data Sync Utilities
 *
 * Provides operational actions to sync Stripe data into Convex
 * (catalog, customer links, subscriptions).
 *
 * Usage:
 *   bunx convex run sync_external_data:syncStripeToConvex
 */

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation } from "./_generated/server";

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

interface StripeLinkingResult {
  checked: number;
  linkedByMetadata: number;
  linkedByEmail: number;
  alreadyLinked: number;
  ambiguousByEmail: number;
  noMatch: number;
  errors: number;
}

interface StripeSyncResult {
  catalogSynced: boolean;
  customerLinking: StripeLinkingResult;
  subscriptionSync: {
    total: number;
    synced: number;
    alreadyInConvex: number;
    skippedInactive: number;
    errors: number;
  };
}

type UserForStripeLink = {
  userId: Id<"users">;
  email: string;
};

async function linkStripeCustomers(
  ctx: ActionCtx,
  stripe: Stripe,
  customerLinking: StripeLinkingResult,
): Promise<void> {
  const users = await ctx.runMutation(
    internal.sync_external_data.getUsersForStripeCustomerLinking,
    {},
  );

  for (const user of users) {
    customerLinking.checked++;

    // TODO: check org-level stripeCustomerId instead of user-level
    // For now, skip the alreadyLinked check since user no longer has stripeCustomerId

    try {
      const byMetadata = await findStripeCustomerByMetadata(stripe, user.userId);
      if (byMetadata) {
        // TODO: resolve organizationId from user context for org-scoped linking
        console.warn("[syncStripeToConvex] Skipping metadata link — needs org-scoped migration", {
          userId: user.userId,
          stripeCustomerId: byMetadata,
        });
        customerLinking.linkedByMetadata++;
        continue;
      }

      const byEmail = await findStripeCustomersByEmail(stripe, user.email);
      if (byEmail.length === 1) {
        // TODO: resolve organizationId from user context for org-scoped linking
        console.warn("[syncStripeToConvex] Skipping email link — needs org-scoped migration", {
          userId: user.userId,
          stripeCustomerId: byEmail[0]!,
        });
        customerLinking.linkedByEmail++;
        continue;
      }

      if (byEmail.length > 1) {
        customerLinking.ambiguousByEmail++;
        console.warn("[syncStripeToConvex] Multiple Stripe customers for email", {
          userId: user.userId,
          email: user.email,
          customerIds: byEmail,
        });
        continue;
      }

      customerLinking.noMatch++;
    } catch (error) {
      customerLinking.errors++;
      console.error("[syncStripeToConvex] Failed customer linking", {
        userId: user.userId,
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const getUsersForStripeCustomerLinking = internalMutation({
  args: {},
  handler: async (ctx): Promise<UserForStripeLink[]> => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      userId: user._id,
      email: user.email,
    }));
  },
});

async function findStripeCustomerByMetadata(
  stripe: Stripe,
  userId: string,
): Promise<string | null> {
  try {
    const search = await stripe.customers.search({
      query: `metadata['userId']:'${userId.replace(/'/g, "\\'")}'`,
      limit: 1,
    });
    return search.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function findStripeCustomersByEmail(stripe: Stripe, email: string): Promise<string[]> {
  const customers = await stripe.customers.list({
    email,
    limit: 10,
  });

  return customers.data.filter((customer) => !customer.deleted).map((customer) => customer.id);
}

/**
 * Sync Stripe data into Convex.
 *
 * Steps:
 * 1. Optionally sync product/price catalog
 * 2. Link Convex users to Stripe customers (metadata first, then email fallback)
 * 3. Reconcile Stripe subscriptions into Convex
 */
export const syncStripeToConvex = internalAction({
  args: {
    syncCatalog: v.optional(v.boolean()),
    linkCustomers: v.optional(v.boolean()),
    syncSubscriptions: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<StripeSyncResult> => {
    const shouldSyncCatalog = args.syncCatalog ?? true;
    const shouldLinkCustomers = args.linkCustomers ?? true;
    const shouldSyncSubscriptions = args.syncSubscriptions ?? true;

    const stripe = getStripeClient();

    const customerLinking: StripeLinkingResult = {
      checked: 0,
      linkedByMetadata: 0,
      linkedByEmail: 0,
      alreadyLinked: 0,
      ambiguousByEmail: 0,
      noMatch: 0,
      errors: 0,
    };

    if (shouldSyncCatalog) {
      await ctx.runAction(internal.stripe.sync.syncFromStripeWebhook, {});
    }

    if (shouldLinkCustomers) {
      await linkStripeCustomers(ctx, stripe, customerLinking);
    }

    const subscriptionSync = shouldSyncSubscriptions
      ? await ctx.runAction(internal.stripe.sync_subscriptions.syncStripeSubscriptions, {})
      : {
          total: 0,
          synced: 0,
          alreadyInConvex: 0,
          skippedInactive: 0,
          errors: 0,
        };

    const result: StripeSyncResult = {
      catalogSynced: shouldSyncCatalog,
      customerLinking,
      subscriptionSync,
    };

    console.warn("[syncStripeToConvex] complete", result);
    return result;
  },
});
