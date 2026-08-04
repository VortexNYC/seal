import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";

type Plan = {
  productId: string;
  name: string;
  tier: string;
  pricing: {
    monthly: { amount: number; currency: string; lookupKey: string } | null;
    yearly: { amount: number; currency: string; lookupKey: string } | null;
  };
};

/**
 * Billing surface E2E — validates the Vortex Payments facade is wired up
 * end-to-end on the test deployment, without driving hosted provider pages.
 *
 * Coverage layered intentionally:
 *   1. Page renders for an authenticated, pro-tier workspace (the seeded state).
 *   2. Plans query returns the Vortex-backed Seal Professional product
 *      (proves backend can read the Vortex-synced catalog).
 *   3. Customer portal and checkout sessions can be created through the
 *      Vortex Payments facade.
 *
 * Hosted checkout completion and webhook subscription projection belong with
 * the live Vortex webhook proof scripts.
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
    await expect(
      authenticatedPage.getByText(/subscription|billing/i).first()
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(
      authenticatedPage.getByText(/something went wrong/i)
    ).not.toBeVisible({
      timeout: 1000,
    });
  });

  test("getAvailablePlans returns active products with pricing", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    const plans = await authenticatedPage.evaluate(async () => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.query(
        api.payments.billing_queries.getAvailablePlans,
        {}
      )) as Plan[];
    });

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    expectPlansReadable(plans);
    expectVortexSealProPlan(plans);
  });

  test("createCustomerPortalSession returns a Vortex portal URL", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    // Drive the action directly off the exposed test-mode Convex client. This
    // is the same call the "Manage Billing" header button makes.
    const result = await authenticatedPage.evaluate(async (returnUrl) => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.action(
        api.payments.subscription_actions.createCustomerPortalSession,
        {
          returnUrl,
        }
      )) as { url: string };
    }, authenticatedPage.url());

    expect(result).toHaveProperty("url");
    expect(result.url).toMatch(/^https:\/\//);
  });

  test("createCheckoutSession returns a Vortex checkout URL for Seal Pro", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    // The pro:monthly:v2 lookup key resolves to the real Vortex-backed Seal
    // Professional monthly price. The facade returns a hosted handoff URL.
    const result = await authenticatedPage.evaluate(async (currentUrl) => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.action(
        api.payments.subscription_actions.createCheckoutSession,
        {
          lookupKey: "pro:monthly:v2",
          successUrl: `${window.location.origin}${window.location.pathname}?upgraded=true`,
          cancelUrl: currentUrl,
        }
      )) as { checkoutUrl: string };
    }, authenticatedPage.url());

    expect(result).toHaveProperty("checkoutUrl");
    expect(result.checkoutUrl).toMatch(/^https:\/\//);
  });
});

function expectPlansReadable(plans: readonly Plan[]): void {
  for (const plan of plans) {
    expect(plan).toHaveProperty("productId");
    expect(plan).toHaveProperty("name");
    expect(plan).toHaveProperty("tier");
    if (plan.pricing.monthly !== null) {
      expect(plan.pricing.monthly).toHaveProperty("lookupKey");
    }
  }
}

function expectVortexSealProPlan(plans: readonly Plan[]): void {
  const proPlan = plans.find((plan) => plan.tier === "pro");
  expect(proPlan).toBeDefined();
  expect(proPlan?.productId).toBe("vtx_prod_seal_professional");
  expect(proPlan?.name).toBe("Seal Professional");
  expect(proPlan?.pricing.monthly).toMatchObject({
    amount: 19,
    lookupKey: "pro:monthly:v2",
  });
  expect(proPlan?.pricing.monthly?.currency.toLowerCase()).toBe("usd");
  expect(proPlan?.pricing.yearly).toMatchObject({
    amount: 180,
    lookupKey: "pro:yearly:v2",
  });
  expect(proPlan?.pricing.yearly?.currency.toLowerCase()).toBe("usd");
}

/**
 * Wait for the billing page to render to the point where the Convex client
 * has finished attaching the Better-Auth auth token. The "Manage Billing" header
 * action only mounts after the auth-gated subscription query resolves, so
 * its presence is a reliable proxy for "auth is attached and queries can
 * fire successfully against authed routes."
 */
async function waitForBillingPageReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      window.__convexClient !== undefined && window.__convexApi !== undefined,
    { timeout: 10000 }
  );
  await page
    .getByRole("button", { name: /manage billing/i })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
}
