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
import { ensureVortexAuthSystemRoles } from "./lib/vortexAuthOrganizations";

/** Migrations registry for Seal Convex schema. */
export const migrations = new Migrations<DataModel>(components.migrations);

export const run = migrations.runner();

/**
 * P2e (part 1) — backfill the vortexAuth COMPONENT org anchor + system roles
 * for every existing organization.
 *
 * Anchors each local org into the component (sets organizations.vortexAuthOrganizationId
 * via upsertOrganization) and seeds Seal's ROLE_PERMISSIONS catalog. Idempotent
 * (upsert keyed by the bridge id; seedDefaultRoles is a no-op on re-run).
 *
 * Membership backfill is intentionally NOT done here: a component membership
 * requires the member's `vortexAuthUserId`, which existing unbridged users do
 * not have until they sign in via Better-Auth. Memberships populate lazily at
 * cutover (P2c/P4); this migration only establishes org + role truth, which
 * needs no user identity.
 */
export const backfillOrganizationComponentAnchors = migrations.define({
  table: "organizations",
  migrateOne: async (ctx, doc) => {
    await ensureVortexAuthSystemRoles(ctx, doc._id);
    console.info(
      `[migration] Anchored org ${doc._id} (${doc.name}) into vortexAuth component + seeded roles`
    );
  },
});

/**
 * Backfill organizationId on legacy subscription documents.
 *
 * Before the org-scoped refactor, subscriptions had a userId field but no
 * organizationId. This migration looks up the organization by matching
 * externalCustomerId → organizations.billingCustomerId.
 *
 * After running, narrow the schema back to v.id("organizations").
 */
export const backfillSubscriptionOrganizationId = migrations.define({
  table: "subscriptions",
  migrateOne: async (ctx, doc) => {
    if (doc.organizationId) return;

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_billing_customer", (q) =>
        q.eq("billingCustomerId", doc.externalCustomerId)
      )
      .unique();

    if (!org) {
      console.error(
        `[migration] No org found for subscription ${doc._id} with customerId ${doc.externalCustomerId}`
      );
      return;
    }

    await ctx.db.patch("subscriptions", doc._id, {
      organizationId: org._id,
      userId: undefined,
    });
    console.info(
      `[migration] Backfilled subscription ${doc._id} → org ${org._id} (${org.name})`
    );
  },
});

/**
 * SEA-593 — clear deprecated `user_profiles.bio` so the schema field can be
 * removed in a follow-up. Identity lives on Vortex Auth; nothing reads bio.
 */
export const clearUserProfileBio = migrations.define({
  table: "user_profiles",
  migrateOne: async (ctx, doc) => {
    if (doc.bio === undefined) return;
    await ctx.db.patch("user_profiles", doc._id, { bio: undefined });
  },
});
