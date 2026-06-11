import type { Page, TestInfo } from "@playwright/test";

import { expect, test } from "../fixtures/auth";
import { convexMutation } from "../fixtures/convex-test-api";

type CheckoutProvider = "vortex_billing" | "stripe";

const lookupKey = process.env.SEAL_BILLING_E2E_LOOKUP_KEY ?? "pro:monthly:v2";
const expectedProvider = readExpectedProvider();
const expectedCheckoutUrlPrefix = process.env.SEAL_BILLING_E2E_CHECKOUT_URL_PREFIX;
const expectedOrganizationIds = new Set(
  (process.env.SEAL_BILLING_E2E_ORGANIZATION_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
);

test.describe("Billing cutover", () => {
  test("upgrade button routes to the active billing provider", async ({
    authenticatedPage,
    organizationSlug,
  }, testInfo) => {
    testInfo.annotations.push({ type: "seal-billing-cutover", description: organizationSlug });
    await ensureRouteWorkspaceIsActive(authenticatedPage, organizationSlug);
    const activeOrganization = await readActiveOrganization(authenticatedPage);
    const activeOrganizationId = activeOrganization.activeOrganizationId;
    if (expectedOrganizationIds.size > 0) {
      expect(activeOrganizationId).not.toBeNull();
      expect(expectedOrganizationIds.has(activeOrganizationId ?? "")).toBe(true);
    }
    await prepareWorkspaceForCutover(activeOrganization.activeOrganizationSlug ?? organizationSlug);

    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);
    await waitForBillingPageReady(authenticatedPage);
    await screenshot(authenticatedPage, testInfo, "billing-ready");

    const provider = await readCheckoutProvider(authenticatedPage);
    expect(provider.provider, JSON.stringify(provider)).toBe(expectedProvider);
    await expectVisibleProMonthlyLookupKey(authenticatedPage);

    if (expectedProvider === "stripe") {
      await expectDirectVortexCheckoutToReject(authenticatedPage);
      await clickUpgrade(authenticatedPage);
      await authenticatedPage.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 });
      expect(authenticatedPage.url()).toContain("checkout.stripe.com");
      await screenshot(authenticatedPage, testInfo, "stripe-hosted-checkout");
      return;
    }

    await clickUpgrade(authenticatedPage);
    await authenticatedPage.waitForURL(/\/pay\//, { timeout: 20000 });
    expect(authenticatedPage.url()).toContain("/pay/");
    if (expectedCheckoutUrlPrefix !== undefined) {
      expect(authenticatedPage.url().startsWith(expectedCheckoutUrlPrefix)).toBe(true);
    }
    await expect(authenticatedPage.getByText(/payment request|pay now/i).first()).toBeVisible({
      timeout: 15000,
    });
    await screenshot(authenticatedPage, testInfo, "vortex-hosted-checkout");
    return;
  });
});

function readExpectedProvider(): CheckoutProvider {
  const raw = process.env.SEAL_BILLING_E2E_EXPECTED_PROVIDER;
  if (raw === "vortex_billing" || raw === "stripe") {
    return raw;
  }
  throw new Error("SEAL_BILLING_E2E_EXPECTED_PROVIDER must be either vortex_billing or stripe.");
}

async function ensureRouteWorkspaceIsActive(page: Page, organizationSlug: string): Promise<void> {
  await page.waitForFunction(
    () => window.__convexClient !== undefined && window.__convexApi !== undefined,
    { timeout: 10000 },
  );
  await page.evaluate(
    async ({ slug }) => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) {
        throw new Error("Convex client not ready");
      }
      await client.mutation(api.organizations.mutations.ensurePersonalOrganization, {
        organizationName: "Seal E2E Workspace",
        organizationSlug: slug,
      });
    },
    { slug: organizationSlug },
  );
}

async function readActiveOrganization(page: Page): Promise<{
  activeOrganizationId: string | null;
  activeOrganizationSlug: string | null;
}> {
  return await page.evaluate(async () => {
    const client = window.__convexClient;
    const api = window.__convexApi;
    if (!client || !api) {
      throw new Error("Convex client not ready");
    }
    const result = (await client.query(api.check_membership.hasOrganization, {})) as {
      activeOrganizationId: string | null;
      activeOrganizationSlug: string | null;
    } | null;
    return {
      activeOrganizationId: result?.activeOrganizationId ?? null,
      activeOrganizationSlug: result?.activeOrganizationSlug ?? null,
    };
  });
}

async function prepareWorkspaceForCutover(organizationSlug: string): Promise<void> {
  const result = (await convexMutation("test_e2e_helpers:prepareBillingCutoverWorkspaceForE2E", {
    organizationSlug,
    lookupKey,
  })) as {
    status: string;
    value?: { prepared?: boolean; reason?: string };
    errorMessage?: string;
  };

  if (result.status !== "success" || result.value?.prepared !== true) {
    throw new Error(`Billing cutover workspace setup failed: ${JSON.stringify(result)}`);
  }
}

async function expectVisibleProMonthlyLookupKey(page: Page): Promise<void> {
  const visibleLookupKey = await page.evaluate(async () => {
    const client = window.__convexClient;
    const api = window.__convexApi;
    if (!client || !api) {
      throw new Error("Convex client not ready");
    }
    const plans = (await client.query(api.stripe.queries.getAvailablePlans, {})) as Array<{
      tier: string | null;
      pricing: { monthly: { lookupKey: string | null } | null };
    }>;
    return plans.find((plan) => plan.tier === "pro")?.pricing.monthly?.lookupKey ?? null;
  });

  expect(visibleLookupKey).toBe(lookupKey);
}

async function waitForBillingPageReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__convexClient !== undefined && window.__convexApi !== undefined,
    { timeout: 10000 },
  );
  await expect(page.getByText(/current plan|available plans|billing/i).first()).toBeVisible({
    timeout: 15000,
  });
}

async function readCheckoutProvider(page: Page): Promise<{
  provider: CheckoutProvider;
  enabledAllOrganizations: boolean;
}> {
  return await page.evaluate(async () => {
    const client = window.__convexClient;
    const api = window.__convexApi;
    if (!client || !api) {
      throw new Error("Convex client not ready");
    }
    const result = (await client.query(
      api.vortex_billing.subscription_actions.getCheckoutProvider,
      {},
    )) as {
      provider: CheckoutProvider;
      enabledAllOrganizations: boolean;
    };
    return result;
  });
}

async function expectDirectVortexCheckoutToReject(page: Page): Promise<void> {
  const rejection = await page.evaluate(
    async ({ lookupKey: checkedLookupKey }) => {
      const client = window.__convexClient;
      const api = window.__convexApi;
      if (!client || !api) {
        throw new Error("Convex client not ready");
      }
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
}

async function clickUpgrade(page: Page): Promise<void> {
  const upgradeButton = page
    .locator(`[data-vortex-plan-lookup-key="${lookupKey}"]`)
    .locator("[data-vortex-plan-action]")
    .first();
  await expect(upgradeButton).toBeVisible({ timeout: 15000 });
  await expect(upgradeButton).toBeEnabled({ timeout: 15000 });
  await upgradeButton.click();
}

async function screenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}
