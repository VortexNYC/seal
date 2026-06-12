import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";

/**
 * Billing surface E2E — validates the Vortex Payments facade is wired up
 * end-to-end on the test deployment, without driving hosted provider pages.
 *
 * Coverage layered intentionally:
 *   1. Page renders for an authenticated, pro-tier workspace (the seeded state).
 *   2. Plans query returns at least one product (proves backend can read
 *      `subscription_products` and the seed worked).
 *   3. Customer portal and checkout sessions can be created through the
 *      Vortex Payments facade.
 *
 * Hosted checkout completion (4242 test card -> webhook -> subscription row)
 * belongs with webhook integration tests (#13).
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

    // Every plan should be readable end-to-end: id, name, tier, pricing.
    // This proves the public Stripe-backed query reaches subscription_products
    // and resolves the joined price rows on the test deployment.
    for (const plan of plans) {
      expect(plan).toHaveProperty("productId");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("tier");
      expect(plan.pricing.monthly).toHaveProperty("lookupKey");
    }
  });

  test("createCustomerPortalSession returns a real Stripe portal URL", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    // Drive the action directly off the exposed test-mode Convex client. This
    // is the same call the "Manage Billing" header button makes and proves the
    // Vortex Payments facade can create a provider portal handoff for the org.
    const result = await authenticatedPage.evaluate(async (returnUrl) => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.action(api.payments.subscription_actions.createCustomerPortalSession, {
        returnUrl,
      })) as { url: string };
    }, authenticatedPage.url());

    expect(result).toHaveProperty("url");
    // Stripe-hosted portal URLs are served from billing.stripe.com.
    expect(result.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
  });

  test("createCheckoutSession returns a hosted checkout URL for a known price", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);

    // The pro:monthly:v2 lookup key resolves to a real recurring price on the
    // shared sandbox account. The facade assembles a hosted checkout session
    // using the seeded customer and returns the handoff URL.
    const result = await authenticatedPage.evaluate(async (currentUrl) => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) throw new Error("Convex client not ready");
      return (await client.action(api.payments.subscription_actions.createCheckoutSession, {
        lookupKey: "pro:monthly:v2",
        successUrl: `${window.location.origin}${window.location.pathname}?upgraded=true`,
        cancelUrl: currentUrl,
      })) as { checkoutUrl: string };
    }, authenticatedPage.url());

    expect(result).toHaveProperty("checkoutUrl");
    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});

/**
 * Wait for the billing page to render to the point where the Convex client
 * has finished attaching the Better-Auth auth token. The "Manage Billing" header
 * action only mounts after the auth-gated subscription query resolves, so
 * its presence is a reliable proxy for "auth is attached and queries can
 * fire successfully against authed routes."
 */
async function waitForBillingPageReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__convexClient !== undefined && window.__convexApi !== undefined,
    { timeout: 10000 },
  );
  await page
    .getByRole("button", { name: /manage billing/i })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
}
