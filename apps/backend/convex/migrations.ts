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
      `[migration] Anchored org ${doc._id} (${doc.name}) into vortexAuth component + seeded roles`,
    );
  },
});

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

// ---------------------------------------------------------------------------
// EPHEMERAL — auth-subject rename data migrations.
//
// One-time backfill + strip used to rename the legacy auth-subject columns to
// `authSubject` on live deployments (the schema no longer declares the old
// fields, so they are read/removed via a local cast). Run order per
// deployment: backfill* → (deploy switched code) → strip*. Delete these once
// every deployment has been migrated.
// ---------------------------------------------------------------------------

/** Backfill `users.authSubject` from the legacy auth-subject column. */
export const backfillUserAuthSubject = migrations.define({
  table: "users",
  migrateOne: async (ctx, doc) => {
    if (doc.authSubject !== undefined) return;
    const legacy = (doc as { clerkId?: string }).clerkId;
    if (legacy !== undefined) await ctx.db.patch(doc._id, { authSubject: legacy });
  },
});

/** Backfill `user_profiles.authSubject` from the legacy auth-subject column. */
export const backfillUserProfilesAuthSubject = migrations.define({
  table: "user_profiles",
  migrateOne: async (ctx, doc) => {
    if (doc.authSubject !== undefined) return;
    const legacy = (doc as { clerkUserId?: string }).clerkUserId;
    if (legacy !== undefined) await ctx.db.patch(doc._id, { authSubject: legacy });
  },
});

/** Strip the legacy auth-subject column from user documents. */
export const stripUserClerkId = migrations.define({
  table: "users",
  migrateOne: async (ctx, doc) => {
    const { _id, _creationTime, ...rest } = doc as typeof doc & { clerkId?: string };
    if (!("clerkId" in rest)) return;
    delete (rest as { clerkId?: string }).clerkId;
    await ctx.db.replace(_id, rest);
  },
});

/** Strip the legacy auth-subject column from user_profiles documents. */
export const stripUserProfilesClerkUserId = migrations.define({
  table: "user_profiles",
  migrateOne: async (ctx, doc) => {
    const { _id, _creationTime, ...rest } = doc as typeof doc & { clerkUserId?: string };
    if (!("clerkUserId" in rest)) return;
    delete (rest as { clerkUserId?: string }).clerkUserId;
    await ctx.db.replace(_id, rest);
  },
});

/** Strip the dead legacy org-id column from organization documents. */
export const stripOrgClerkId = migrations.define({
  table: "organizations",
  migrateOne: async (ctx, doc) => {
    const { _id, _creationTime, ...rest } = doc as typeof doc & { clerkId?: string };
    if (!("clerkId" in rest)) return;
    delete (rest as { clerkId?: string }).clerkId;
    await ctx.db.replace(_id, rest);
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
