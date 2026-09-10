import { expect, test } from "../fixtures/auth";
import { convexQuery } from "../fixtures/convex-test-api";

type Plan = {
  productId: string;
  name: string;
  tier: string;
  pricing: {
    monthly: { amount: number; currency: string; lookupKey: string } | null;
    yearly: { amount: number; currency: string; lookupKey: string } | null;
  };
};

function isPlan(value: unknown): value is Plan {
  return (
    typeof value === "object" &&
    value !== null &&
    "productId" in value &&
    typeof value.productId === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "tier" in value &&
    typeof value.tier === "string" &&
    "pricing" in value &&
    typeof value.pricing === "object" &&
    value.pricing !== null
  );
}

function parsePlans(value: unknown): Plan[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `getAvailablePlans returned a non-array: ${JSON.stringify(value)}`
    );
  }
  const plans = value.filter(isPlan);
  if (plans.length !== value.length) {
    throw new Error(
      `getAvailablePlans returned unexpected plan shapes: ${JSON.stringify(value)}`
    );
  }
  return plans;
}

test.describe("Billing", () => {
  test("billing settings page renders for the seeded pro workspace", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);

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

  test("getAvailablePlans returns active products with pricing", async () => {
    const rawPlans = await convexQuery(
      "payments.billing_queries.getAvailablePlans",
      {}
    );
    const plans = parsePlans(rawPlans);

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    expectPlansReadable(plans);
    expectVortexSealProPlan(plans);
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
