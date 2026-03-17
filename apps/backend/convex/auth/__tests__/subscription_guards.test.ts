import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import {
  PLAN_LIMITS,
  ensureProFeature,
  getSubscriptionPlan,
} from "../subscription_guards";

describe("subscription_guards", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });
  });

  /** Helper: seed a full pro subscription chain (product -> price -> subscription) */
  async function seedProSubscription(overrides?: {
    subscriptionStatus?:
      | "active"
      | "canceled"
      | "past_due"
      | "trialing"
      | "incomplete"
      | "incomplete_expired"
      | "unpaid";
    tier?: string;
  }) {
    const now = Date.now();
    const status = overrides?.subscriptionStatus ?? "active";
    const tier = overrides?.tier ?? "pro";

    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("subscription_products", {
        externalProductId: "prod_test_123",
        name: "Seal Pro",
        status: "active",
        metadata: { tier },
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscription_prices", {
        externalPriceId: "price_test_123",
        externalProductId: "prod_test_123",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1500,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        organizationId,
        externalCustomerId: "cus_test_123",
        externalSubscriptionId: "sub_test_123",
        externalPriceId: "price_test_123",
        status,
        currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    });
  }


  // ---------------------------------------------------------------------------
  // PLAN_LIMITS
  // ---------------------------------------------------------------------------
  describe("PLAN_LIMITS", () => {
    test("free tier allows 1 seat", () => {
      expect(PLAN_LIMITS.free.maxSeats).toBe(1);
    });

    test("free tier blocks templates and branding", () => {
      expect(PLAN_LIMITS.free.templates).toBe(false);
      expect(PLAN_LIMITS.free.branding).toBe(false);
    });

    test("pro tier allows 20 seats", () => {
      expect(PLAN_LIMITS.pro.maxSeats).toBe(20);
    });

    test("pro tier enables templates and branding", () => {
      expect(PLAN_LIMITS.pro.templates).toBe(true);
      expect(PLAN_LIMITS.pro.branding).toBe(true);
    });

    test("enterprise tier has unlimited seats", () => {
      expect(PLAN_LIMITS.enterprise.maxSeats).toBe(Infinity);
    });

    test("enterprise tier enables SSO", () => {
      expect(PLAN_LIMITS.enterprise.sso).toBe(true);
    });

    test("pro tier does not enable SSO", () => {
      expect(PLAN_LIMITS.pro.sso).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getSubscriptionPlan
  // ---------------------------------------------------------------------------
  describe("getSubscriptionPlan", () => {
    test("returns free plan when user has no subscription", async () => {
      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns pro plan for active subscription with pro tier product", async () => {
      await seedProSubscription();

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
    });

    test("returns pro plan for trialing subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "trialing" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
    });

    test("returns free plan for canceled subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "canceled" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan for past_due subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "past_due" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan for incomplete subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "incomplete" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan for unpaid subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "unpaid" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan when product tier is not pro", async () => {
      await seedProSubscription({ tier: "basic" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan when product has no metadata tier", async () => {
      const now = Date.now();

      // Insert product without a tier in metadata
      const productId = await t.run(async (ctx) => {
        return await ctx.db.insert("subscription_products", {
          externalProductId: "prod_no_tier",
          name: "Seal Basic",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("subscription_prices", {
          externalPriceId: "price_no_tier",
          externalProductId: "prod_no_tier",
          subscriptionProductId: productId,
          type: "recurring",
          billingScheme: "per_unit",
          currency: "usd",
          unitAmount: 0,
          recurring: { interval: "month", intervalCount: 1 },
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("subscriptions", {
          organizationId,
          externalCustomerId: "cus_no_tier",
          externalSubscriptionId: "sub_no_tier",
          externalPriceId: "price_no_tier",
          status: "active",
          currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          cancelAtPeriodEnd: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });
  });

  // ---------------------------------------------------------------------------
  // ensureProFeature
  // ---------------------------------------------------------------------------
  describe("ensureProFeature", () => {
    test("does not throw for pro user", async () => {
      await seedProSubscription();

      await t.run(async (ctx) => {
        await expect(
          ensureProFeature(ctx.db, organizationId, "Workspace sharing"),
        ).resolves.toBeUndefined();
      });
    });

    test("throws ConvexError with Professional plan keyword for free user", async () => {
      await t.run(async (ctx) => {
        await expect(ensureProFeature(ctx.db, organizationId, "Workspace sharing")).rejects.toThrow(
          ConvexError,
        );
      });
    });

    test("error message contains feature name and upgrade keyword", async () => {
      try {
        await t.run(async (ctx) => {
          await ensureProFeature(ctx.db, organizationId, "Custom branding");
        });
        // Should not reach here
        expect.unreachable("Expected ensureProFeature to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("Custom branding");
        expect(message).toContain("Professional plan");
        expect(message).toContain("upgrade");
      }
    });
  });

});
