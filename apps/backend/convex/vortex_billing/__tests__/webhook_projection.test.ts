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

  async function seedVortexSubscription(input: {
    readonly externalSubscriptionId: string;
    readonly status?: "active" | "past_due" | "trialing";
    readonly lastSourceEventAt?: number;
    readonly latestInvoiceId?: string;
    readonly latestInvoiceStatus?: string;
    readonly pastDueSince?: number;
  }): Promise<void> {
    await t.run((ctx) =>
      ctx.db.insert("subscriptions", {
        organizationId,
        externalCustomerId: "vtx_cust_projection",
        externalSubscriptionId: input.externalSubscriptionId,
        externalPriceId: "vtx_price_projection",
        status: input.status ?? "active",
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        latestInvoiceId: input.latestInvoiceId,
        latestInvoiceStatus: input.latestInvoiceStatus,
        pastDueSince: input.pastDueSince,
        lastSourceEventAt: input.lastSourceEventAt,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async function subscriptionByExternalId(externalSubscriptionId: string) {
    return await t.run((ctx) =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_external_subscription_id", (q) =>
          q.eq("externalSubscriptionId", externalSubscriptionId),
        )
        .first(),
    );
  }

  async function eventRows(eventId: string) {
    return await t.run((ctx) =>
      ctx.db
        .query("vortex_billing_webhook_events")
        .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
        .collect(),
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

  test("projects invoice.paid recovery onto active and clears dunning anchor", async () => {
    const subscriptionId = "vtx_sub_invoice_paid";
    await seedProCatalog("vtx_price_projection");
    await seedVortexSubscription({
      externalSubscriptionId: subscriptionId,
      status: "past_due",
      pastDueSince: now - 1_000,
    });

    const result = await t.mutation(internal.vortex_billing.projection.projectInvoicePaid, {
      eventId: "evt_vortex_invoice_paid",
      eventType: "invoice.paid",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_paid_001",
      invoiceStatus: "paid",
      sourceCreatedAt: now + 1_000,
    });

    expect(result).toMatchObject({ processed: true, duplicate: false, ignored: false });
    const subscription = await subscriptionByExternalId(subscriptionId);
    expect(subscription).toMatchObject({
      status: "active",
      latestInvoiceId: "inv_vortex_paid_001",
      latestInvoiceStatus: "paid",
      lastSourceEventAt: now + 1_000,
    });
    expect(subscription?.pastDueSince).toBeUndefined();

    const plan = await t.run((ctx) => getSubscriptionPlan(ctx.db, organizationId));
    expect(plan).toEqual({ isPro: true, isEnterprise: false, plan: "pro" });
  });

  test("projects invoice.payment_failed onto past_due and latest invoice fields", async () => {
    const subscriptionId = "vtx_sub_invoice_failed";
    await seedVortexSubscription({ externalSubscriptionId: subscriptionId, status: "active" });

    const failureStartedAfter = Date.now();
    const result = await t.mutation(internal.vortex_billing.projection.projectInvoicePaymentFailed, {
      eventId: "evt_vortex_invoice_failed",
      eventType: "invoice.payment_failed",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_failed_001",
      invoiceStatus: "payment_failed",
      sourceCreatedAt: now + 2_000,
    });
    const failureStartedBefore = Date.now();

    expect(result).toMatchObject({ processed: true, duplicate: false, ignored: false });
    const subscription = await subscriptionByExternalId(subscriptionId);
    expect(subscription).toMatchObject({
      status: "past_due",
      latestInvoiceId: "inv_vortex_failed_001",
      latestInvoiceStatus: "payment_failed",
      lastSourceEventAt: now + 2_000,
    });
    expect(subscription?.pastDueSince).toBeGreaterThanOrEqual(failureStartedAfter);
    expect(subscription?.pastDueSince).toBeLessThanOrEqual(failureStartedBefore);
  });

  test("anchors pastDueSince once across repeated invoice.payment_failed events", async () => {
    const subscriptionId = "vtx_sub_invoice_failed_anchor";
    await seedVortexSubscription({ externalSubscriptionId: subscriptionId, status: "active" });

    await t.mutation(internal.vortex_billing.projection.projectInvoicePaymentFailed, {
      eventId: "evt_vortex_invoice_failed_anchor_first",
      eventType: "invoice.payment_failed",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_failed_anchor_001",
      invoiceStatus: "payment_failed",
      sourceCreatedAt: now + 2_100,
    });

    const firstProjection = await subscriptionByExternalId(subscriptionId);
    const anchoredPastDueSince = firstProjection?.pastDueSince;
    expect(anchoredPastDueSince).toBeTypeOf("number");

    await t.mutation(internal.vortex_billing.projection.projectInvoicePaymentFailed, {
      eventId: "evt_vortex_invoice_failed_anchor_second",
      eventType: "invoice.payment_failed",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_failed_anchor_002",
      invoiceStatus: "payment_failed",
      sourceCreatedAt: now + 2_200,
    });

    const secondProjection = await subscriptionByExternalId(subscriptionId);
    expect(secondProjection).toMatchObject({
      status: "past_due",
      latestInvoiceId: "inv_vortex_failed_anchor_002",
      latestInvoiceStatus: "payment_failed",
      lastSourceEventAt: now + 2_200,
      pastDueSince: anchoredPastDueSince,
    });
  });

  test("ignores invoice events without subscriptionExternalId without writing state or dedup rows", async () => {
    const result = await t.mutation(internal.vortex_billing.projection.projectInvoicePaid, {
      eventId: "evt_vortex_invoice_missing_subscription",
      eventType: "invoice.paid",
      invoiceNumber: "inv_vortex_missing_subscription",
      invoiceStatus: "paid",
      sourceCreatedAt: now + 3_000,
    });

    expect(result).toMatchObject({ processed: false, duplicate: false, ignored: true });
    expect(await eventRows("evt_vortex_invoice_missing_subscription")).toHaveLength(0);
  });

  test("ignores invoice events for missing subscriptions without throwing or writing dedup rows", async () => {
    const result = await t.mutation(internal.vortex_billing.projection.projectInvoicePaid, {
      eventId: "evt_vortex_invoice_missing_sub_row",
      eventType: "invoice.paid",
      subscriptionExternalId: "vtx_sub_not_created_yet",
      invoiceNumber: "inv_vortex_missing_sub_row",
      invoiceStatus: "paid",
      sourceCreatedAt: now + 4_000,
    });

    expect(result).toMatchObject({ processed: false, duplicate: false, ignored: true });
    expect(await eventRows("evt_vortex_invoice_missing_sub_row")).toHaveLength(0);
  });

  test("dedupes duplicate invoice event ids after the first correlated projection", async () => {
    const subscriptionId = "vtx_sub_invoice_duplicate";
    await seedVortexSubscription({ externalSubscriptionId: subscriptionId, status: "active" });
    const projection = {
      eventId: "evt_vortex_invoice_duplicate",
      eventType: "invoice.paid" as const,
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_duplicate_001",
      invoiceStatus: "paid",
      sourceCreatedAt: now + 5_000,
    };

    const first = await t.mutation(internal.vortex_billing.projection.projectInvoicePaid, projection);
    const second = await t.mutation(internal.vortex_billing.projection.projectInvoicePaid, {
      ...projection,
      invoiceNumber: "inv_vortex_duplicate_002",
    });

    expect(first).toMatchObject({ processed: true, duplicate: false, ignored: false });
    expect(second).toMatchObject({ processed: false, duplicate: true });
    expect(await subscriptionByExternalId(subscriptionId)).toMatchObject({
      latestInvoiceId: "inv_vortex_duplicate_001",
    });
    expect(await eventRows(projection.eventId)).toHaveLength(1);
  });

  test("keeps past_due when a stale subscription.updated active event arrives after payment failure", async () => {
    const priceId = "vtx_price_stale_subscription_update";
    const subscriptionId = "vtx_sub_stale_subscription_update";
    const newerEventAt = now + 10_000;
    const olderEventAt = now + 9_000;
    await seedProCatalog(priceId);
    await seedVortexSubscription({ externalSubscriptionId: subscriptionId, status: "active" });

    await t.mutation(internal.vortex_billing.projection.projectInvoicePaymentFailed, {
      eventId: "evt_vortex_newer_invoice_failure",
      eventType: "invoice.payment_failed",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_newer_failure",
      invoiceStatus: "payment_failed",
      sourceCreatedAt: newerEventAt,
    });

    await t.mutation(internal.vortex_billing.projection.projectSubscriptionUpdated, {
      eventId: "evt_vortex_older_subscription_active",
      eventType: "subscription.updated",
      sealOrganizationId: organizationId,
      subscriptionExternalId: subscriptionId,
      customerExternalId: "vtx_cust_projection",
      planCode: priceId,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      sourceCreatedAt: olderEventAt,
    });

    expect(await subscriptionByExternalId(subscriptionId)).toMatchObject({
      status: "past_due",
      lastSourceEventAt: newerEventAt,
    });
  });

  test("keeps active when a stale invoice.payment_failed arrives after a newer subscription.updated", async () => {
    const priceId = "vtx_price_stale_invoice_failure";
    const subscriptionId = "vtx_sub_stale_invoice_failure";
    const newerEventAt = now + 12_000;
    const olderEventAt = now + 11_000;
    await seedProCatalog(priceId);

    await t.mutation(internal.vortex_billing.projection.projectSubscriptionUpdated, {
      eventId: "evt_vortex_newer_subscription_active",
      eventType: "subscription.updated",
      sealOrganizationId: organizationId,
      subscriptionExternalId: subscriptionId,
      customerExternalId: "vtx_cust_projection",
      planCode: priceId,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      sourceCreatedAt: newerEventAt,
    });

    await t.mutation(internal.vortex_billing.projection.projectInvoicePaymentFailed, {
      eventId: "evt_vortex_older_invoice_failure",
      eventType: "invoice.payment_failed",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_older_failure",
      invoiceStatus: "payment_failed",
      sourceCreatedAt: olderEventAt,
    });

    expect(await subscriptionByExternalId(subscriptionId)).toMatchObject({
      status: "active",
      lastSourceEventAt: newerEventAt,
    });
  });

  test("does not widen past_due to active for equal-millisecond subscription.updated events", async () => {
    const priceId = "vtx_price_equal_ms_subscription_update";
    const subscriptionId = "vtx_sub_equal_ms_subscription_update";
    const eventAt = now + 13_000;
    await seedProCatalog(priceId);
    await seedVortexSubscription({
      externalSubscriptionId: subscriptionId,
      status: "past_due",
      lastSourceEventAt: eventAt,
    });

    await t.mutation(internal.vortex_billing.projection.projectSubscriptionUpdated, {
      eventId: "evt_vortex_equal_ms_subscription_active",
      eventType: "subscription.updated",
      sealOrganizationId: organizationId,
      subscriptionExternalId: subscriptionId,
      customerExternalId: "vtx_cust_projection",
      planCode: priceId,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      sourceCreatedAt: eventAt,
    });

    expect(await subscriptionByExternalId(subscriptionId)).toMatchObject({
      status: "past_due",
      lastSourceEventAt: eventAt,
    });
  });

  test("does not dedup uncorrelatable invoices so corrected redrives with the same event id still process", async () => {
    const subscriptionId = "vtx_sub_invoice_redrive";
    const eventId = "evt_vortex_invoice_redrive";
    await seedVortexSubscription({ externalSubscriptionId: subscriptionId, status: "active" });

    const uncorrelatable = await t.mutation(
      internal.vortex_billing.projection.projectInvoicePaid,
      {
        eventId,
        eventType: "invoice.paid",
        invoiceNumber: "inv_vortex_redrive_uncorrelatable",
        invoiceStatus: "paid",
        sourceCreatedAt: now + 14_000,
      },
    );
    const corrected = await t.mutation(internal.vortex_billing.projection.projectInvoicePaid, {
      eventId,
      eventType: "invoice.paid",
      subscriptionExternalId: subscriptionId,
      invoiceNumber: "inv_vortex_redrive_corrected",
      invoiceStatus: "paid",
      sourceCreatedAt: now + 15_000,
    });

    expect(uncorrelatable).toMatchObject({ processed: false, ignored: true });
    expect(corrected).toMatchObject({ processed: true, duplicate: false, ignored: false });
    expect(await subscriptionByExternalId(subscriptionId)).toMatchObject({
      latestInvoiceId: "inv_vortex_redrive_corrected",
    });
    expect(await eventRows(eventId)).toHaveLength(1);
  });
});
