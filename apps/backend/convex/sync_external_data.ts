/**
 * External Data Sync Utilities
 *
 * Provides operational actions to:
 * 1. Sync users from Clerk into Convex
 * 2. Sync Stripe data into Convex (catalog, customer links, subscriptions)
 * 3. Run both in sequence (Clerk first, then Stripe)
 *
 * Usage:
 *   bunx convex run sync_external_data:syncClerkThenStripeToConvex
 */

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import Stripe from "stripe";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation } from "./_generated/server";

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY not configured");
  }
  return createClerkClient({ secretKey });
}

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

interface ClerkUserSyncResult {
  totalFetched: number;
  synced: number;
  created: number;
  updated: number;
  skippedNoEmail: number;
  errors: number;
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

interface CombinedSyncResult {
  clerk: ClerkUserSyncResult;
  stripe: StripeSyncResult;
}

type UserForStripeLink = {
  userId: Id<"users">;
  email: string;
};

function getPrimaryEmailAddress(clerkUser: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
}): { email: string; isVerified: boolean } | null {
  const primaryEmail =
    clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId) ??
    clerkUser.emailAddresses[0];
  const email = primaryEmail?.emailAddress?.toLowerCase();

  if (!email) {
    return null;
  }

  return {
    email,
    isVerified: primaryEmail?.verification?.status === "verified",
  };
}

async function syncClerkUserRecord(
  ctx: ActionCtx,
  clerkUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    emailAddresses: Array<{
      id: string;
      emailAddress: string;
      verification?: { status?: string | null } | null;
    }>;
    primaryEmailAddressId: string | null;
    imageUrl: string;
    locale: string | null;
  },
): Promise<"created" | "updated" | "skipped_no_email" | "error"> {
  const primaryEmail = getPrimaryEmailAddress(clerkUser);
  if (!primaryEmail) {
    return "skipped_no_email";
  }

  const firstName = clerkUser.firstName ?? "";
  const lastName = clerkUser.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || undefined;

  try {
    const result = await ctx.runMutation(api.clerk_webhooks.syncUser, {
      clerkId: clerkUser.id,
      name: fullName,
      email: primaryEmail.email,
      avatar: clerkUser.imageUrl || undefined,
      isEmailVerified: primaryEmail.isVerified,
      locale: clerkUser.locale ?? undefined,
    });

    return result.isNewUser ? "created" : "updated";
  } catch (error) {
    console.error("[syncUsersFromClerkToConvex] Failed to sync user", {
      clerkUserId: clerkUser.id,
      email: primaryEmail.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return "error";
  }
}

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

/**
 * Sync all Clerk users into Convex users table.
 * Idempotent: existing users are updated, missing users are created.
 */
export const syncUsersFromClerkToConvex = internalAction({
  args: {
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ClerkUserSyncResult> => {
    const clerk = getClerkClient();
    const pageSize = Math.max(1, Math.min(args.pageSize ?? 100, 500));

    let offset = 0;
    let totalFetched = 0;
    let synced = 0;
    let created = 0;
    let updated = 0;
    let skippedNoEmail = 0;
    let errors = 0;

    while (true) {
      const page = await clerk.users.getUserList({
        limit: pageSize,
        offset,
      });

      if (page.data.length === 0) {
        break;
      }

      for (const clerkUser of page.data) {
        totalFetched++;
        const outcome = await syncClerkUserRecord(ctx, clerkUser);
        if (outcome === "created") {
          synced++;
          created++;
        } else if (outcome === "updated") {
          synced++;
          updated++;
        } else if (outcome === "skipped_no_email") {
          skippedNoEmail++;
        } else {
          errors++;
        }
      }

      offset += page.data.length;
      if (offset >= page.totalCount) {
        break;
      }
    }

    const result: ClerkUserSyncResult = {
      totalFetched,
      synced,
      created,
      updated,
      skippedNoEmail,
      errors,
    };

    console.warn("[syncUsersFromClerkToConvex] complete", result);
    return result;
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

/**
 * One-shot operational sequence:
 * 1. Sync Clerk users -> Convex
 * 2. Sync Stripe -> Convex
 */
export const syncClerkThenStripeToConvex = internalAction({
  args: {
    pageSize: v.optional(v.number()),
    syncCatalog: v.optional(v.boolean()),
    linkCustomers: v.optional(v.boolean()),
    syncSubscriptions: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<CombinedSyncResult> => {
    const clerk = await ctx.runAction(internal.sync_external_data.syncUsersFromClerkToConvex, {
      pageSize: args.pageSize,
    });

    const stripe = await ctx.runAction(internal.sync_external_data.syncStripeToConvex, {
      syncCatalog: args.syncCatalog,
      linkCustomers: args.linkCustomers,
      syncSubscriptions: args.syncSubscriptions,
    });

    const result: CombinedSyncResult = { clerk, stripe };
    console.warn("[syncClerkThenStripeToConvex] complete", result);
    return result;
  },
});
