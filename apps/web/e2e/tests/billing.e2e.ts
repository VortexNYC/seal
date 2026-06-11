import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";

type CheckoutProvider = "vortex_billing" | "stripe";

const lookupKey = process.env.SEAL_BILLING_E2E_LOOKUP_KEY ?? "pro:monthly:v2";
const expectedProvider = readExpectedProvider();

/**
 * Billing surface E2E validates the Vortex Billing integration on the test
 * deployment without driving the hosted checkout form.
 *
 * Coverage layered intentionally:
 *   1. Page renders for an authenticated, pro-tier workspace (the seeded state).
 *   2. Plans query returns at least one product (proves backend can read
 *      `subscription_products` and the seed worked).
 *   3. Checkout provider contract matches the active environment. Stripe
 *      deployments must reject direct Vortex checkout; Vortex deployments must
 *      return a hosted Vortex checkout URL.
 */

test.describe("Billing", () => {
  test("billing settings page renders for the seeded pro workspace", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);

    // The "Subscription" / "Plans" section should mount. We don't tie to one
    // specific heading because the page has multiple — `getByText` with the
    // word "subscription" first is enough to confirm the route resolved and
    // the auth-gated layout rendered without falling through to an error
    // boundary.
    await expect(authenticatedPage.getByText(/subscription|billing/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(authenticatedPage.getByText(/something went wrong/i)).not.toBeVisible({
      timeout: 1000,
    });
  });

  test("getAvailablePlans returns active products with pricing", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    type Plan = {
      productId: string;
      name: string;
      tier: string;
      pricing: { monthly: { amount: number; currency: string; lookupKey: string } | null };
    };

    const plans = await authenticatedPage.evaluate(async () => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.query(api.stripe.queries.getAvailablePlans, {})) as Plan[];
    });

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);

    // Every plan should be readable end-to-end: id, name, tier, pricing. This
    // proves the subscription catalog resolves the joined price rows on the
    // test deployment.
    for (const plan of plans) {
      expect(plan).toHaveProperty("productId");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("tier");
      expect(plan.pricing.monthly).toHaveProperty("lookupKey");
    }
  });

  test("checkout session honors the active billing provider", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    const provider = await authenticatedPage.evaluate(async () => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.query(
        api.vortex_billing.subscription_actions.getCheckoutProvider,
        {},
      )) as {
        provider: CheckoutProvider;
        enabledAllOrganizations: boolean;
      };
    });

    expect(provider.provider, JSON.stringify(provider)).toBe(expectedProvider);

    if (expectedProvider === "stripe") {
      const rejection = await authenticatedPage.evaluate(
        async ({ lookupKey: checkedLookupKey }) => {
          const client = window.__convexClient;
          const api = window.__convexApi;
          if (!client || !api) throw new Error("Convex client not ready");
          try {
            await client.action(api.vortex_billing.subscription_actions.createCheckoutSession, {
              lookupKey: checkedLookupKey,
            });
            return "";
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
        { lookupKey },
      );

      expect(rejection).toContain("Vortex Billing SaaS checkout is not enabled");
      return;
    }

    const result = await authenticatedPage.evaluate(
      async ({ lookupKey: checkedLookupKey }) => {
        const client = window.__convexClient;
        const api = window.__convexApi;
        if (!client || !api) throw new Error("Convex client not ready");
        return (await client.action(api.vortex_billing.subscription_actions.createCheckoutSession, {
          lookupKey: checkedLookupKey,
        })) as {
          checkoutSessionId: string;
          checkoutUrl: string;
          subscriptionExternalId: string;
        };
      },
      { lookupKey },
    );

    expect(result.checkoutSessionId).toMatch(/^plink_/);
    expect(result.checkoutUrl).toContain("/pay/");
    expect(result.subscriptionExternalId).toMatch(/^vtx_sub_seal_org_/);
  });
});

function readExpectedProvider(): CheckoutProvider {
  const raw = process.env.SEAL_BILLING_E2E_EXPECTED_PROVIDER ?? "vortex_billing";
  if (raw === "vortex_billing" || raw === "stripe") {
    return raw;
  }
  throw new Error("SEAL_BILLING_E2E_EXPECTED_PROVIDER must be either vortex_billing or stripe.");
}

/**
 * Wait for the billing page to render to the point where the Convex client
 * has finished attaching the Better-Auth auth token and the auth-gated billing
 * route has mounted.
 */
async function waitForBillingPageReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__convexClient !== undefined && window.__convexApi !== undefined,
    { timeout: 10000 },
  );
  await expect(page.getByText(/current plan|available plans|billing/i).first()).toBeVisible({
    timeout: 15000,
  });
}
