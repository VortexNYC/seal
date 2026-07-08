import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

/**
 * Integration tests for the Stripe webhook business-logic handlers.
 *
 * These exercise the *post-signature-verification* layer — the
 * `internalMutation`s that the HTTP route at `/stripe-webhook` dispatches
 * into once the Stripe SDK has verified the request signature. The
 * signature/dispatch layer is covered by Stripe's own SDK; what's specific
 * to Seal is the state these mutations write per event.
 *
 * Without this suite, a refactor that breaks how subscriptions are recorded
 * after a successful checkout silently lets paying customers slip into
 * "free tier" mode in our DB even though they're paying Stripe.
 */

const FAKE_PRICE_ID = "price_fake_pro_test";

describe("Stripe webhook handlers", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;

  beforeEach(async () => {
    delete process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS;

    t = createTestContext();

    organizationId = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Stripe Test Org",
        slug: "stripe-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        stripeCustomerId: "cus_fake_test_001",
        updatedAt: Date.now(),
      }),
    );

    // Seed product + price referenced by the synthetic subscription so the
    // handler's price lookup resolves cleanly.
    const productId = await t.run((ctx) =>
      ctx.db.insert("subscription_products", {
        externalProductId: "prod_fake_pro_test",
        name: "Test Pro",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    await t.run((ctx) =>
      ctx.db.insert("subscription_prices", {
        externalPriceId: FAKE_PRICE_ID,
        externalProductId: "prod_fake_pro_test",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1500,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  });

  afterEach(() => {
    delete process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS;
  });

  function allowlistOrgForVortexBilling(): void {
    process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS = JSON.stringify([organizationId]);
  }

  /**
   * Build a synthetic Stripe.Subscription payload shaped just enough for
   * `extractSubscriptionData` to pull out everything the handler needs.
   * `as any` because the real Stripe.Subscription type has hundreds of
   * fields we don't care about for this test.
   */
  function buildSubscription(
    overrides?: Partial<{ id: string; status: string; metadata: Record<string, string> }>,
  ) {
    const now = Math.floor(Date.now() / 1000);
    return {
      id: overrides?.id ?? "sub_fake_test_001",
      object: "subscription",
      customer: "cus_fake_test_001",
      status: overrides?.status ?? "active",
      cancel_at_period_end: false,
      canceled_at: null,
      cancellation_details: null,
      trial_start: null,
      trial_end: null,
      latest_invoice: null,
      metadata: { organizationId, ...overrides?.metadata },
      items: {
        data: [
          {
            price: { id: FAKE_PRICE_ID },
            current_period_start: now - 60 * 60,
            current_period_end: now + 30 * 24 * 60 * 60,
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  function buildInvoice(subscriptionId: string, overrides?: Partial<{ id: string; status: string }>) {
    return {
      id: overrides?.id ?? "in_fake_test_001",
      object: "invoice",
      status: overrides?.status ?? "paid",
      customer: "cus_fake_test_001",
      amount_paid: 1500,
      amount_due: 1500,
      currency: "usd",
      parent: {
        subscription_details: {
          subscription: subscriptionId,
        },
      },
    } as unknown as Stripe.Invoice;
  }

  describe("handleSubscriptionCreated", () => {
    test("inserts a subscription row tied to the org via metadata", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription(),
      });

      const stored = await t.run(async (ctx) => {
        return ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_fake_test_001"),
          )
          .first();
      });

      expect(stored).not.toBeNull();
      expect(stored?.organizationId).toBe(organizationId);
      expect(stored?.status).toBe("active");
      expect(stored?.externalCustomerId).toBe("cus_fake_test_001");
      expect(stored?.externalPriceId).toBe(FAKE_PRICE_ID);
      expect(stored?.cancelAtPeriodEnd).toBe(false);
    });

    test("falls back to organization lookup by stripeCustomerId when metadata is missing", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({
          id: "sub_fake_test_002",
          // Empty metadata — the resolver should still find the org via
          // `organizations.stripeCustomerId`, which we seeded above.
          metadata: { organizationId: undefined as unknown as string },
        }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_fake_test_002"),
          )
          .first(),
      );

      expect(stored).not.toBeNull();
      expect(stored?.organizationId).toBe(organizationId);
    });

    test("skips creating Stripe subscription state for Vortex-billed orgs", async () => {
      allowlistOrgForVortexBilling();

      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_vortex_skip_create" }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_vortex_skip_create"),
          )
          .first(),
      );

      expect(stored).toBeNull();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    test("patches the existing subscription's status", async () => {
      // Create first.
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_fake_test_003" }),
      });

      // Then update to past_due.
      await t.mutation(internal.stripe.handlers.handleSubscriptionUpdated, {
        subscription: buildSubscription({ id: "sub_fake_test_003", status: "past_due" }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_fake_test_003"),
          )
          .first(),
      );
      expect(stored?.status).toBe("past_due");
    });

    test("skips updating Stripe subscription state for Vortex-billed orgs", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_vortex_skip_update" }),
      });
      allowlistOrgForVortexBilling();

      await t.mutation(internal.stripe.handlers.handleSubscriptionUpdated, {
        subscription: buildSubscription({ id: "sub_vortex_skip_update", status: "past_due" }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_vortex_skip_update"),
          )
          .first(),
      );
      expect(stored?.status).toBe("active");
    });
  });

  describe("handleSubscriptionDeleted", () => {
    test("marks the subscription as canceled", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_fake_test_004" }),
      });

      await t.mutation(internal.stripe.handlers.handleSubscriptionDeleted, {
        subscription: buildSubscription({ id: "sub_fake_test_004", status: "canceled" }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_fake_test_004"),
          )
          .first(),
      );
      expect(stored?.status).toBe("canceled");
    });

    test("skips deleting Stripe subscription state for Vortex-billed orgs", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_vortex_skip_delete" }),
      });
      allowlistOrgForVortexBilling();

      await t.mutation(internal.stripe.handlers.handleSubscriptionDeleted, {
        subscription: buildSubscription({ id: "sub_vortex_skip_delete", status: "canceled" }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_vortex_skip_delete"),
          )
          .first(),
      );
      expect(stored?.status).toBe("active");
    });
  });

  describe("invoice handlers", () => {
    test("keeps Stripe invoice payment failure from mutating Vortex-billed org state", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_vortex_skip_invoice_failure" }),
      });
      allowlistOrgForVortexBilling();

      await t.mutation(internal.stripe.handlers.handlePaymentFailed, {
        invoice: buildInvoice("sub_vortex_skip_invoice_failure", {
          id: "in_vortex_skip_invoice_failure",
          status: "open",
        }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_vortex_skip_invoice_failure"),
          )
          .first(),
      );
      expect(stored?.status).toBe("active");
      expect(stored?.latestInvoiceId).toBeUndefined();
    });

    test("keeps Stripe invoice payment success from mutating Vortex-billed org state", async () => {
      await t.mutation(internal.stripe.handlers.handleSubscriptionCreated, {
        subscription: buildSubscription({ id: "sub_vortex_skip_invoice_success" }),
      });
      allowlistOrgForVortexBilling();

      await t.mutation(internal.stripe.handlers.handlePaymentSucceeded, {
        invoice: buildInvoice("sub_vortex_skip_invoice_success", {
          id: "in_vortex_skip_invoice_success",
        }),
      });

      const stored = await t.run(async (ctx) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_external_subscription_id", (q) =>
            q.eq("externalSubscriptionId", "sub_vortex_skip_invoice_success"),
          )
          .first(),
      );
      expect(stored?.status).toBe("active");
      expect(stored?.latestInvoiceId).toBeUndefined();
    });
  });
});
