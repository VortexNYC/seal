import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { getSubscriptionPlan } from "../../auth/subscription_guards";
import { createTestContext } from "../../test.setup";

const now = Date.UTC(2026, 0, 1);
const periodStart = "2026-01-01T00:00:00.000Z";
const periodEnd = "2026-02-01T00:00:00.000Z";

describe("Vortex Billing subscription projection", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;

  beforeEach(async () => {
    t = createTestContext();
    organizationId = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Vortex SaaS Projection Org",
        slug: "vortex-saas-projection-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: now,
      }),
    );
  });

  async function seedProCatalog(priceId: string): Promise<void> {
    const productId = await t.run((ctx) =>
      ctx.db.insert("subscription_products", {
        externalProductId: "vtx_prod_seal_pro",
        name: "Seal Pro",
        status: "active",
        metadata: { tier: "pro", features: "api_access,webhook_access" },
        createdAt: now,
        updatedAt: now,
      }),
    );

    await t.run((ctx) =>
      ctx.db.insert("subscription_prices", {
        externalPriceId: priceId,
        externalProductId: "vtx_prod_seal_pro",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 2900,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        lookupKey: "pro:business:month:v1",
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async function seedActiveStripeSubscription(): Promise<void> {
    await t.run((ctx) =>
      ctx.db.insert("subscriptions", {
        organizationId,
        externalCustomerId: "cus_old_stripe",
        externalSubscriptionId: "sub_old_stripe",
        externalPriceId: "price_old_stripe",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async function activeSubscriptions() {
    return await t.run((ctx) =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect(),
    );
  }

  test("projects active Vortex subscription and removes active Stripe-shaped ids", async () => {
    const priceId = "vtx_price_seal_pro_monthly";
    const subscriptionId = "vtx_sub_seal_org_123_pro_monthly";
    const customerId = "vtx_cust_seal_org_123";
    await seedProCatalog(priceId);
    await seedActiveStripeSubscription();

    const result = await t.mutation(internal.vortex_billing.projection.projectSubscriptionUpdated, {
      eventId: "evt_vortex_subscription_active",
      eventType: "subscription.updated",
      sealOrganizationId: organizationId,
      subscriptionExternalId: subscriptionId,
      customerExternalId: customerId,
      planCode: priceId,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    expect(result).toMatchObject({
      processed: true,
      duplicate: false,
      activeStripeIdPresent: false,
      externalSubscriptionId: subscriptionId,
    });

    const active = await activeSubscriptions();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      externalCustomerId: customerId,
      externalSubscriptionId: subscriptionId,
      externalPriceId: priceId,
      status: "active",
      currentPeriodStart: Date.parse(periodStart),
      currentPeriodEnd: Date.parse(periodEnd),
    });

    const oldStripeSubscription = await t.run((ctx) =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_external_subscription_id", (q) =>
          q.eq("externalSubscriptionId", "sub_old_stripe"),
        )
        .first(),
    );
    expect(oldStripeSubscription?.status).toBe("canceled");

    const plan = await t.run((ctx) => getSubscriptionPlan(ctx.db, organizationId));
    expect(plan).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
  });

  test("ignores duplicate Vortex event ids", async () => {
    const priceId = "vtx_price_duplicate_pro_monthly";
    await seedProCatalog(priceId);
    const projection = {
      eventId: "evt_vortex_subscription_duplicate",
      eventType: "subscription.updated" as const,
      sealOrganizationId: organizationId,
      subscriptionExternalId: "vtx_sub_duplicate",
      customerExternalId: "vtx_cust_duplicate",
      planCode: priceId,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    };

    const first = await t.mutation(
      internal.vortex_billing.projection.projectSubscriptionUpdated,
      projection,
    );
    const second = await t.mutation(
      internal.vortex_billing.projection.projectSubscriptionUpdated,
      projection,
    );

    expect(first.processed).toBe(true);
    expect(second).toMatchObject({ processed: false, duplicate: true });
    expect(await activeSubscriptions()).toHaveLength(1);

    const eventRows = await t.run((ctx) =>
      ctx.db
        .query("vortex_billing_webhook_events")
        .withIndex("by_event_id", (q) => q.eq("eventId", projection.eventId))
        .collect(),
    );
    expect(eventRows).toHaveLength(1);
  });
});
