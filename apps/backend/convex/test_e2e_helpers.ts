/**
 * E2E Test Helpers
 *
 * Internal mutations used exclusively by Playwright global.setup.ts
 * to seed test data in the E2E test deployment.
 *
 * These functions are NOT public API and should never be called in production.
 */

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Gate all public test helpers behind an env var that is only set on the E2E
 * test deployment (coordinated-lemur-768).  Without this, any unauthenticated
 * caller who knows the Convex URL could invoke these mutations.
 *
 * To enable: `bunx convex env set E2E_DEPLOYMENT_SECRET <any-value> --deployment coordinated-lemur-768`
 */
function requireE2eDeployment(): void {
  if (!process.env.E2E_DEPLOYMENT_SECRET) {
    throw new Error(
      "Test helper functions are disabled. E2E_DEPLOYMENT_SECRET is not set on this deployment.",
    );
  }
}

/**
 * Seed a pro subscription for the E2E workspace, looked up by its known slug.
 * Called from global.setup.ts via `bunx convex run` — no org ID required.
 *
 * Uses a regular mutation (not internal) so it's callable from the CLI.
 * Only deployed on the E2E test deployment — never exposed in production.
 */
export const seedProSubscriptionForE2E = mutation({
  args: {
    organizationSlug: v.string(),
  },
  handler: async (ctx, { organizationSlug }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();

    if (!org) {
      return { seeded: false, reason: "org_not_found" };
    }

    const now = Date.now();
    const externalProductId = "prod_e2e_test_pro";
    const externalPriceId = "price_e2e_test_pro_monthly";

    // Ensure product exists with tier: "pro" metadata so getSubscriptionDetails resolves tier correctly
    const existingProduct = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
      .first();

    if (!existingProduct) {
      await ctx.db.insert("subscription_products", {
        externalProductId,
        name: "Seal Pro (E2E Test)",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Ensure price exists
    const existingPrice = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", externalPriceId))
      .first();

    if (!existingPrice) {
      const product = await ctx.db
        .query("subscription_products")
        .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
        .first();

      await ctx.db.insert("subscription_prices", {
        externalPriceId,
        externalProductId,
        subscriptionProductId: product!._id,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1500,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Idempotency check — product/price are always ensured above regardless
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing")))
      .first();

    if (existing) return { seeded: false, reason: "subscription_already_active" };

    await ctx.db.insert("subscriptions", {
      organizationId: org._id,
      externalCustomerId: "cus_e2e_test",
      externalSubscriptionId: `sub_e2e_test_${org._id}`,
      externalPriceId,
      status: "active",
      currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: now + 365 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return { seeded: true, orgId: org._id };
  },
});

/**
 * Purge all documents for the E2E workspace to prevent dashboard queries from
 * hitting Convex's per-transaction task limit after many test runs.
 *
 * Deletes up to `batchSize` documents per call (idempotent, call multiple times
 * if the org has accumulated many documents). Returns the number deleted and
 * whether more remain.
 */
export const purgeE2EDocuments = mutation({
  args: {
    organizationSlug: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { organizationSlug, batchSize = 200 }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();

    if (!org) {
      return { deleted: 0, hasMore: false, reason: "org_not_found" };
    }

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .take(batchSize + 1);

    const hasMore = docs.length > batchSize;
    const toDelete = docs.slice(0, batchSize);

    for (const doc of toDelete) {
      await ctx.db.delete(doc._id);
    }

    return { deleted: toDelete.length, hasMore };
  },
});

/**
 * Generate a Convex storage upload URL for E2E test PDF seeding.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    requireE2eDeployment();
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a minimal test document for E2E tests.
 * Accepts a pre-uploaded storageId so the PDF only needs to be uploaded once.
 * Returns the new document's _id.
 */
export const createTestDocument = mutation({
  args: {
    organizationSlug: v.string(),
    storageId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { organizationSlug, storageId, name }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();
    if (!org) throw new Error(`org_not_found: ${organizationSlug}`);

    // Find any user in this org — try active org index first, then fall back to any user
    let owner = await ctx.db
      .query("users")
      .withIndex("by_active_org", (q) => q.eq("activeOrganizationId", org._id))
      .first();
    if (!owner) {
      // activeOrganizationId may not be set; find any user via org memberships
      // Use the well-known E2E test user Clerk ID as a reliable fallback
      const e2eClerkId = "user_3B4i0q60eWUsHUVSbdnnVPLmRT7"; // seal-e2e+clerk_test@example.com
      owner =
        (await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", e2eClerkId))
          .first()) ?? (await ctx.db.query("users").first());
    }
    if (!owner) throw new Error("no_user_found_for_org");

    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      organizationId: org._id,
      ownerId: owner._id,
      name: name ?? `e2e-test-doc-${now}`,
      status: "active",
      workflowStatus: "draft",
      sharingMode: "private",
      fileSize: 12345,
      fileType: "application/pdf",
      storageId,
      createdAt: now,
      updatedAt: now,
    });

    return { id: docId };
  },
});

/**
 * Delete a test document by ID.
 */
export const deleteTestDocument = mutation({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, { documentId }) => {
    requireE2eDeployment();
    const id = documentId as Id<"documents">;
    const doc = await ctx.db.get(id);
    if (doc) await ctx.db.delete(id);
    return { deleted: !!doc };
  },
});

/**
 * Debug: get org info by slug (no auth required).
 */
export const getOrgDebugInfo = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!org) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", org._id))
      .first();
    return { slug: org.slug, clerkId: org.clerkId, hasSub: !!sub, subStatus: sub?.status };
  },
});

/**
 * Seed a pro subscription for the given organization.
 * Idempotent — does nothing if an active subscription already exists.
 */
export const seedProSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, { organizationId }) => {
    // Check if org already has an active subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing")))
      .first();

    if (existing) return { seeded: false, reason: "subscription_already_active" };

    const now = Date.now();
    const externalProductId = "prod_e2e_test_pro";
    const externalPriceId = "price_e2e_test_pro_monthly";

    // Ensure product exists
    const existingProduct = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
      .first();

    if (!existingProduct) {
      await ctx.db.insert("subscription_products", {
        externalProductId,
        name: "Seal Pro (E2E Test)",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Ensure price exists
    const existingPrice = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", externalPriceId))
      .first();

    if (!existingPrice) {
      await ctx.db.insert("subscription_prices", {
        externalPriceId,
        externalProductId,
        subscriptionProductId: (await ctx.db
          .query("subscription_products")
          .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
          .first())!._id,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1500,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create subscription
    await ctx.db.insert("subscriptions", {
      organizationId,
      externalCustomerId: "cus_e2e_test",
      externalSubscriptionId: `sub_e2e_test_${organizationId}`,
      externalPriceId,
      status: "active",
      currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: now + 365 * 24 * 60 * 60 * 1000, // 1 year
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return { seeded: true };
  },
});
