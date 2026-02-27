import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import {
  PLAN_LIMITS,
  ensureDocumentLimit,
  ensureProFeature,
  ensureStorageLimit,
  getSubscriptionPlan,
} from "../subscription_guards";

describe("subscription_guards", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

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

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "user@test.com",
        name: "Test User",
        clerkId: "clerk_test_user",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
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
        userId,
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

  /** Helper: insert a document for the test user */
  async function seedDocument(overrides?: {
    createdAt?: number;
    fileSize?: number;
    status?: "active" | "archived" | "deleted";
  }) {
    const now = Date.now();
    return await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        organizationId,
        ownerId: userId,
        name: "Test Document",
        fileSize: overrides?.fileSize ?? 1024,
        fileType: "application/pdf",
        storageId: `storage_${Math.random().toString(36).slice(2)}`,
        sharingMode: "private",
        status: overrides?.status ?? "active",
        createdAt: overrides?.createdAt ?? now,
        updatedAt: now,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // PLAN_LIMITS
  // ---------------------------------------------------------------------------
  describe("PLAN_LIMITS", () => {
    test("free tier has 10 documents per month", () => {
      expect(PLAN_LIMITS.free.documentsPerMonth).toBe(10);
    });

    test("free tier has 100 MB storage", () => {
      expect(PLAN_LIMITS.free.storageBytes).toBe(100 * 1024 * 1024);
    });

    test("pro tier has 500 documents per month", () => {
      expect(PLAN_LIMITS.pro.documentsPerMonth).toBe(500);
    });

    test("pro tier has 10 GB storage", () => {
      expect(PLAN_LIMITS.pro.storageBytes).toBe(10 * 1024 * 1024 * 1024);
    });
  });

  // ---------------------------------------------------------------------------
  // getSubscriptionPlan
  // ---------------------------------------------------------------------------
  describe("getSubscriptionPlan", () => {
    test("returns free plan when user has no subscription", async () => {
      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
    });

    test("returns pro plan for active subscription with pro tier product", async () => {
      await seedProSubscription();

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: true, plan: "pro" });
    });

    test("returns pro plan for trialing subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "trialing" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: true, plan: "pro" });
    });

    test("returns free plan for canceled subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "canceled" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
    });

    test("returns free plan for past_due subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "past_due" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
    });

    test("returns free plan for incomplete subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "incomplete" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
    });

    test("returns free plan for unpaid subscription", async () => {
      await seedProSubscription({ subscriptionStatus: "unpaid" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
    });

    test("returns free plan when product tier is not pro", async () => {
      await seedProSubscription({ tier: "basic" });

      const result = await t.run(async (ctx) => {
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
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
          userId,
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
        return await getSubscriptionPlan(ctx.db, userId);
      });
      expect(result).toEqual({ isPro: false, plan: "free" });
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
          ensureProFeature(ctx.db, userId, "Workspace sharing"),
        ).resolves.toBeUndefined();
      });
    });

    test("throws ConvexError with Pro plan keyword for free user", async () => {
      await t.run(async (ctx) => {
        await expect(ensureProFeature(ctx.db, userId, "Workspace sharing")).rejects.toThrow(
          ConvexError,
        );
      });
    });

    test("error message contains feature name and upgrade keyword", async () => {
      try {
        await t.run(async (ctx) => {
          await ensureProFeature(ctx.db, userId, "Custom branding");
        });
        // Should not reach here
        expect.unreachable("Expected ensureProFeature to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("Custom branding");
        expect(message).toContain("Pro plan");
        expect(message).toContain("upgrade");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // ensureDocumentLimit
  // ---------------------------------------------------------------------------
  describe("ensureDocumentLimit", () => {
    test("does not throw when free user is under limit", async () => {
      // Insert 5 documents (under the 10 limit)
      for (let i = 0; i < 5; i++) {
        await seedDocument();
      }

      await t.run(async (ctx) => {
        await expect(ensureDocumentLimit(ctx.db, userId)).resolves.toBeUndefined();
      });
    });

    test("throws when free user reaches 10 documents this month", async () => {
      for (let i = 0; i < 10; i++) {
        await seedDocument();
      }

      await t.run(async (ctx) => {
        await expect(ensureDocumentLimit(ctx.db, userId)).rejects.toThrow(ConvexError);
      });
    });

    test("does not count deleted documents toward limit", async () => {
      // Insert 10 documents but mark them all as deleted
      for (let i = 0; i < 10; i++) {
        await seedDocument({ status: "deleted" });
      }

      await t.run(async (ctx) => {
        await expect(ensureDocumentLimit(ctx.db, userId)).resolves.toBeUndefined();
      });
    });

    test("does not count documents from previous months", async () => {
      // Insert documents dated to last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthTimestamp = lastMonth.getTime();

      for (let i = 0; i < 10; i++) {
        await seedDocument({ createdAt: lastMonthTimestamp });
      }

      await t.run(async (ctx) => {
        await expect(ensureDocumentLimit(ctx.db, userId)).resolves.toBeUndefined();
      });
    });

    test("pro user can create more than 10 documents per month", async () => {
      await seedProSubscription();

      // Insert 15 documents (over free limit but under pro limit)
      for (let i = 0; i < 15; i++) {
        await seedDocument();
      }

      await t.run(async (ctx) => {
        await expect(ensureDocumentLimit(ctx.db, userId)).resolves.toBeUndefined();
      });
    });

    test("pro user is blocked at 500 documents per month", async () => {
      await seedProSubscription();

      // Insert 500 documents
      for (let i = 0; i < 500; i++) {
        await seedDocument();
      }

      await t.run(async (ctx) => {
        await expect(ensureDocumentLimit(ctx.db, userId)).rejects.toThrow(ConvexError);
      });
    });

    test("free user error message suggests upgrading", async () => {
      for (let i = 0; i < 10; i++) {
        await seedDocument();
      }

      try {
        await t.run(async (ctx) => {
          await ensureDocumentLimit(ctx.db, userId);
        });
        expect.unreachable("Expected ensureDocumentLimit to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("upgrade");
        expect(message).toContain("Pro plan");
      }
    });

    test("pro user error message suggests contacting support", async () => {
      await seedProSubscription();

      for (let i = 0; i < 500; i++) {
        await seedDocument();
      }

      try {
        await t.run(async (ctx) => {
          await ensureDocumentLimit(ctx.db, userId);
        });
        expect.unreachable("Expected ensureDocumentLimit to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("contact support");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // ensureStorageLimit
  // ---------------------------------------------------------------------------
  describe("ensureStorageLimit", () => {
    test("does not throw when free user is under storage limit", async () => {
      // 50 MB of existing documents
      await seedDocument({ fileSize: 50 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding 10 MB should be fine (60 MB total, under 100 MB)
        await expect(ensureStorageLimit(ctx.db, userId, 10 * 1024 * 1024)).resolves.toBeUndefined();
      });
    });

    test("throws when free user would exceed 100 MB", async () => {
      // 90 MB of existing documents
      await seedDocument({ fileSize: 90 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding 20 MB would exceed the 100 MB limit
        await expect(ensureStorageLimit(ctx.db, userId, 20 * 1024 * 1024)).rejects.toThrow(
          ConvexError,
        );
      });
    });

    test("does not count deleted documents toward storage", async () => {
      // 90 MB of deleted documents
      await seedDocument({ fileSize: 90 * 1024 * 1024, status: "deleted" });

      await t.run(async (ctx) => {
        // Adding 20 MB should be fine since deleted docs are excluded
        await expect(ensureStorageLimit(ctx.db, userId, 20 * 1024 * 1024)).resolves.toBeUndefined();
      });
    });

    test("pro user can store more than 100 MB", async () => {
      await seedProSubscription();

      // 500 MB of existing documents
      await seedDocument({ fileSize: 500 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding 100 MB should be fine (600 MB total, under 10 GB)
        await expect(
          ensureStorageLimit(ctx.db, userId, 100 * 1024 * 1024),
        ).resolves.toBeUndefined();
      });
    });

    test("pro user is blocked when exceeding 10 GB", async () => {
      await seedProSubscription();

      // 9.5 GB of existing documents
      await seedDocument({ fileSize: 9.5 * 1024 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding 1 GB would exceed the 10 GB limit
        await expect(ensureStorageLimit(ctx.db, userId, 1 * 1024 * 1024 * 1024)).rejects.toThrow(
          ConvexError,
        );
      });
    });

    test("allows upload that exactly fills remaining capacity", async () => {
      // 50 MB existing
      await seedDocument({ fileSize: 50 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding exactly 50 MB hits 100 MB but does NOT exceed it
        await expect(ensureStorageLimit(ctx.db, userId, 50 * 1024 * 1024)).resolves.toBeUndefined();
      });
    });

    test("blocks upload that exceeds limit by 1 byte", async () => {
      // Fill to exactly 100 MB
      await seedDocument({ fileSize: 100 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding even 1 byte should exceed the limit
        await expect(ensureStorageLimit(ctx.db, userId, 1)).rejects.toThrow(ConvexError);
      });
    });

    test("sums file sizes across multiple documents", async () => {
      // Insert 3 documents totaling 95 MB
      await seedDocument({ fileSize: 30 * 1024 * 1024 });
      await seedDocument({ fileSize: 30 * 1024 * 1024 });
      await seedDocument({ fileSize: 35 * 1024 * 1024 });

      await t.run(async (ctx) => {
        // Adding 10 MB would be 105 MB, exceeding the 100 MB limit
        await expect(ensureStorageLimit(ctx.db, userId, 10 * 1024 * 1024)).rejects.toThrow(
          ConvexError,
        );
      });
    });

    test("free user error message suggests upgrading", async () => {
      await seedDocument({ fileSize: 100 * 1024 * 1024 });

      try {
        await t.run(async (ctx) => {
          await ensureStorageLimit(ctx.db, userId, 1);
        });
        expect.unreachable("Expected ensureStorageLimit to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("upgrade");
        expect(message).toContain("Pro plan");
        expect(message).toContain("Storage limit exceeded");
      }
    });

    test("pro user error message suggests contacting support", async () => {
      await seedProSubscription();
      await seedDocument({ fileSize: 10 * 1024 * 1024 * 1024 });

      try {
        await t.run(async (ctx) => {
          await ensureStorageLimit(ctx.db, userId, 1);
        });
        expect.unreachable("Expected ensureStorageLimit to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        const message = (error as ConvexError<string>).data;
        expect(message).toContain("contact support");
        expect(message).toContain("Storage limit exceeded");
      }
    });
  });
});
