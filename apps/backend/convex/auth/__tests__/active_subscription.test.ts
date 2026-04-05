import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

/**
 * Tests for the `by_organization_status` compound index on subscriptions.
 * This index is used by `getActiveSubscription()` in auth.ts, which runs
 * on every authenticated request via `getAuthContext()`.
 */
describe("getActiveSubscription (by_organization_status index)", () => {
  let t: ReturnType<typeof createTestContext>;
  let orgId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;

  const now = Date.now();
  const baseSub = {
    externalCustomerId: "cus_test",
    externalSubscriptionId: "sub_test",
    externalPriceId: "price_test",
    currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
    currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  } as const;

  beforeEach(async () => {
    t = createTestContext();

    orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: now,
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: now,
      });
    });
  });

  /** Mirrors getActiveSubscription() from auth.ts */
  async function queryActiveSubscription(organizationId: Id<"organizations">) {
    return await t.run(async (ctx) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .first();
    });
  }

  test("returns active subscription for the organization", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: orgId,
        status: "active",
      });
    });

    const result = await queryActiveSubscription(orgId);
    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(orgId);
    expect(result!.status).toBe("active");
  });

  test("returns undefined when no subscription exists", async () => {
    const result = await queryActiveSubscription(orgId);
    expect(result).toBeNull();
  });

  test("returns undefined when subscription exists but is not active", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: orgId,
        status: "canceled",
      });
    });

    const result = await queryActiveSubscription(orgId);
    expect(result).toBeNull();
  });

  test("ignores active subscriptions belonging to other organizations", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: otherOrgId,
        externalSubscriptionId: "sub_other",
        status: "active",
      });
    });

    const result = await queryActiveSubscription(orgId);
    expect(result).toBeNull();
  });

  test("returns only active subscription when org has multiple with different statuses", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: orgId,
        externalSubscriptionId: "sub_canceled",
        status: "canceled",
      });
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: orgId,
        externalSubscriptionId: "sub_active",
        status: "active",
      });
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: orgId,
        externalSubscriptionId: "sub_past_due",
        status: "past_due",
      });
    });

    const result = await queryActiveSubscription(orgId);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("active");
    expect(result!.externalSubscriptionId).toBe("sub_active");
  });

  test("does not return trialing subscription when querying for active", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        ...baseSub,
        organizationId: orgId,
        status: "trialing",
      });
    });

    const result = await queryActiveSubscription(orgId);
    expect(result).toBeNull();
  });
});
