/**
 * E2E Test Helpers
 *
 * Internal mutations used exclusively by Playwright global.setup.ts
 * to seed test data in the E2E test deployment.
 *
 * These functions are NOT public API and should never be called in production.
 */

import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

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
      .filter((q) =>
        q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing")),
      )
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
      .filter((q) =>
        q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing")),
      )
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
        subscriptionProductId: (
          await ctx.db
            .query("subscription_products")
            .withIndex("by_external_product_id", (q) =>
              q.eq("externalProductId", externalProductId),
            )
            .first()
        )!._id,
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
