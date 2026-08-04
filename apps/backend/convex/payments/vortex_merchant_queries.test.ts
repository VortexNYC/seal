import { describe, expect, test } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";

async function insertOrganization(
  t: ReturnType<typeof createTestContext>
): Promise<Id<"organizations">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Vortex Merchant Resolver Test",
      slug: `vortex-merchant-resolver-${Date.now()}`,
      type: "company",
      isActive: true,
      timezone: "UTC",
      updatedAt: Date.now(),
    });
  });
}

describe("Vortex merchant resolver", () => {
  test("returns only charges-ready stored Vortex merchant accounts", async () => {
    const t = createTestContext();
    const organizationId = await insertOrganization(t);

    await expect(
      t.query(
        internal.payments.vortex_merchant_queries
          .getVortexMerchantAccountIdForOrg,
        {
          organizationId,
        }
      )
    ).resolves.toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.insert("merchant_accounts", {
        organizationId,
        provider: "vortex",
        providerAccountId: "ma_not_ready",
        accountType: "standard",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        feeHandling: "absorb",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.query(
        internal.payments.vortex_merchant_queries
          .getVortexMerchantAccountIdForOrg,
        {
          organizationId,
        }
      )
    ).resolves.toBeNull();

    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("merchant_accounts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId)
        )
        .first();
      if (!account) {
        throw new Error("Expected resolver account");
      }
      await ctx.db.patch(account._id, {
        chargesEnabled: true,
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.query(
        internal.payments.vortex_merchant_queries
          .getVortexMerchantAccountIdForOrg,
        {
          organizationId,
        }
      )
    ).resolves.toBe("ma_not_ready");
  });
});
