import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { seedTestOrganizationMember } from "../../testVortexAuth";
import {
  GRACE_PERIOD_MS,
  PLAN_LIMITS,
  ensureProFeature,
  ensureSeatLimit,
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
  async function seedSubscription(overrides?: {
    subscriptionStatus?:
      | "active"
      | "canceled"
      | "past_due"
      | "trialing"
      | "incomplete"
      | "incomplete_expired"
      | "unpaid";
    tier?: string;
    pastDueSince?: number;
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
        pastDueSince: overrides?.pastDueSince,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  /** Helper: add an active member to the test org */
  async function seedMember() {
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: `user-${Math.random().toString(36).slice(2)}@test.com`,
        name: "Test User",
        authSubject: `${Math.random().toString(36).slice(2)}`,
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        organizationId,
        userId,
        role: "member",
        status: "active",
      });
    });
  }

  // ---------------------------------------------------------------------------
  // PLAN_LIMITS
  // ---------------------------------------------------------------------------
  describe("PLAN_LIMITS", () => {
    test("free tier has 1 max seat", () => {
      expect(PLAN_LIMITS.free.maxSeats).toBe(1);
    });

    test("free tier has templates disabled", () => {
      expect(PLAN_LIMITS.free.templates).toBe(false);
    });

    test("free tier has branding disabled", () => {
      expect(PLAN_LIMITS.free.branding).toBe(false);
    });

    test("pro tier has 20 max seats", () => {
      expect(PLAN_LIMITS.pro.maxSeats).toBe(20);
    });

    test("pro tier has templates enabled", () => {
      expect(PLAN_LIMITS.pro.templates).toBe(true);
    });

    test("pro tier has branding enabled", () => {
      expect(PLAN_LIMITS.pro.branding).toBe(true);
    });

    test("enterprise tier has unlimited seats", () => {
      expect(PLAN_LIMITS.enterprise.maxSeats).toBe(Infinity);
    });

    test("enterprise tier has sso enabled", () => {
      expect(PLAN_LIMITS.enterprise.sso).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getSubscriptionPlan
  // ---------------------------------------------------------------------------
  describe("getSubscriptionPlan", () => {
    test("returns free plan when org has no subscription", async () => {
      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns pro plan for active subscription with pro tier product", async () => {
      await seedSubscription();

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
    });

    test("returns pro plan for trialing subscription", async () => {
      await seedSubscription({ subscriptionStatus: "trialing" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
    });

    test("returns enterprise plan for enterprise tier product", async () => {
      await seedSubscription({ tier: "enterprise" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: true, isEnterprise: true, plan: "enterprise" });
    });

    test("returns free plan for canceled subscription", async () => {
      await seedSubscription({ subscriptionStatus: "canceled" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns pro plan for past_due subscription within grace", async () => {
      await seedSubscription({ subscriptionStatus: "past_due", pastDueSince: Date.now() });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
    });

    test("returns free plan for past_due subscription beyond grace", async () => {
      await seedSubscription({
        subscriptionStatus: "past_due",
        pastDueSince: Date.now() - GRACE_PERIOD_MS - 24 * 60 * 60 * 1000,
      });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan for incomplete subscription", async () => {
      await seedSubscription({ subscriptionStatus: "incomplete" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan for unpaid subscription", async () => {
      await seedSubscription({ subscriptionStatus: "unpaid" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, organizationId);
      });
      expect(result).toEqual({ isPro: false, isEnterprise: false, plan: "free" });
    });

    test("returns free plan when product tier is not pro or enterprise", async () => {
      await seedSubscription({ tier: "basic" });

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
    test("does not throw for pro org", async () => {
      await seedSubscription();

      await t.run(async (ctx) => {
        await expect(
          ensureProFeature(ctx.db, organizationId, "Workspace sharing"),
        ).resolves.toBeUndefined();
      });
    });

    test("does not throw for enterprise org", async () => {
      await seedSubscription({ tier: "enterprise" });

      await t.run(async (ctx) => {
        await expect(
          ensureProFeature(ctx.db, organizationId, "Workspace sharing"),
        ).resolves.toBeUndefined();
      });
    });

    test("throws ConvexError for free org", async () => {
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
        expect.unreachable("Expected ensureProFeature to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("Custom branding");
        expect(message).toContain("upgrade");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // ensureSeatLimit
  // ---------------------------------------------------------------------------
  describe("ensureSeatLimit", () => {
    test("does not throw when org has no members (free plan, 0 of 1)", async () => {
      await t.run(async (ctx) => {
        await expect(ensureSeatLimit(ctx, organizationId)).resolves.toBeUndefined();
      });
    });

    test("throws when free org has reached 1 seat limit", async () => {
      await seedMember();

      await t.run(async (ctx) => {
        await expect(ensureSeatLimit(ctx, organizationId)).rejects.toThrow(ConvexError);
      });
    });

    test("pro org can add up to 20 members", async () => {
      await seedSubscription();

      for (let i = 0; i < 19; i++) {
        await seedMember();
      }

      await t.run(async (ctx) => {
        await expect(ensureSeatLimit(ctx, organizationId)).resolves.toBeUndefined();
      });
    });

    test("throws when pro org reaches 20 seat limit", async () => {
      await seedSubscription();

      for (let i = 0; i < 20; i++) {
        await seedMember();
      }

      await t.run(async (ctx) => {
        await expect(ensureSeatLimit(ctx, organizationId)).rejects.toThrow(ConvexError);
      });
    });

    test("error message contains upgrade suggestion for free plan", async () => {
      await seedMember();

      try {
        await t.run(async (ctx) => {
          await ensureSeatLimit(ctx, organizationId);
        });
        expect.unreachable("Expected ensureSeatLimit to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("Upgrade");
      }
    });
  });
});
