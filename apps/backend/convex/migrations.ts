/**
 * Convex Migrations
 *
 * Provides a proper framework for schema migrations using @convex-dev/migrations.
 * Define individual migrations using `migrations.define()` and run them via the
 * `run` function from the Convex dashboard or CLI.
 */

import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

export const run = migrations.runner();

/**
 * Backfill organizationId on legacy subscription documents.
 *
 * Before the org-scoped refactor, subscriptions had a userId field but no
 * organizationId. This migration looks up the organization by matching
 * externalCustomerId → organizations.stripeCustomerId.
 *
 * After running, narrow the schema back to v.id("organizations").
 */
export const backfillSubscriptionOrganizationId = migrations.define({
  table: "subscriptions",
  migrateOne: async (ctx, doc) => {
    if (doc.organizationId) return;

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer_id", (q) => q.eq("stripeCustomerId", doc.externalCustomerId))
      .unique();

    if (!org) {
      console.error(
        `[migration] No org found for subscription ${doc._id} with customerId ${doc.externalCustomerId}`,
      );
      return;
    }

    await ctx.db.patch(doc._id, { organizationId: org._id, userId: undefined });
    console.info(`[migration] Backfilled subscription ${doc._id} → org ${org._id} (${org.name})`);
  },
});

/**
 * Remove legacy stripeCustomerId from user documents.
 *
 * Stripe customer IDs were moved to the organizations table during the
 * org-scoped refactor. This clears the leftover field from users.
 *
 * After running, remove stripeCustomerId from the users schema.
 */
export const removeUserStripeCustomerId = migrations.define({
  table: "users",
  migrateOne: async (ctx, doc) => {
    if (!doc.stripeCustomerId) return;
    await ctx.db.patch(doc._id, { stripeCustomerId: undefined });
    console.info(`[migration] Cleared stripeCustomerId from user ${doc._id}`);
  },
});
