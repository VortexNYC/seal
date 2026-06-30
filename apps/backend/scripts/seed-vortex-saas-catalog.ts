/*
 * One-time Vortex Billing SaaS catalog seed.
 *
 * Run manually with Bun/Node and VORTEX_BILLING_API_BASE_URL +
 * VORTEX_BILLING_API_KEY set. Never run this in CI.
 *
 * Operators must edit the PLACEHOLDER catalog entries below before running:
 * - set real product/price ids
 * - set real unitAmount values in minor currency units
 * - mirror the printed lookupKey -> priceId map into VORTEX_BILLING_SAAS_PRICE_MAP
 */

import { createClient, createProduct, createPrice } from "@vortexnyc/payments-sdk";

type BillingInterval = "day" | "week" | "month" | "year";

type SeedPlanDefinition = {
  readonly lookupKey: string;
  readonly productId: string;
  readonly priceId: string;
  readonly name: string;
  readonly currency: string;
  readonly billingInterval: BillingInterval;
  readonly billingIntervalCount: number;
  readonly unitAmount: number;
};

const SEAL_SAAS_PLANS = [
  {
    lookupKey: "pro:monthly:v2",
    productId: "prod_seal_pro",
    priceId: "price_seal_pro_monthly_v2",
    name: "Seal Pro (Monthly)",
    currency: "usd",
    billingInterval: "month",
    billingIntervalCount: 1,
    unitAmount: 0, // OPERATOR: set real amount in cents before running.
  },
  {
    lookupKey: "pro:yearly:v2",
    productId: "prod_seal_pro",
    priceId: "price_seal_pro_yearly_v2",
    name: "Seal Pro (Yearly)",
    currency: "usd",
    billingInterval: "year",
    billingIntervalCount: 1,
    unitAmount: 0, // OPERATOR: set real amount in cents before running.
  },
] as const satisfies readonly SeedPlanDefinition[];

type CatalogMutationResult = {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly response?: Response;
};

async function main(): Promise<void> {
  if (process.env.CI === "true") {
    throw new Error("seed-vortex-saas-catalog.ts is manual-only and must never run in CI");
  }

  validateOperatorEditedPlans(SEAL_SAAS_PLANS);

  const apiBaseUrl = readRequiredEnv("VORTEX_BILLING_API_BASE_URL");
  const apiKey = readRequiredEnv("VORTEX_BILLING_API_KEY");
  const client = createClient({
    baseUrl: trimTrailingSlash(apiBaseUrl),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-vortex-service": "billing",
    },
  });

  const seededPriceMap: Record<string, string> = {};

  for (const plan of SEAL_SAAS_PLANS) {
    const productResult = await createProduct({
      client,
      headers: { "Idempotency-Key": `seal-saas-product:${plan.productId}` },
      body: {
        productId: plan.productId,
        name: plan.name,
      },
    });

    handleCatalogResult(productResult, `product ${plan.productId}`);

    const priceResult = await createPrice({
      client,
      headers: { "Idempotency-Key": `seal-saas-price:${plan.priceId}` },
      body: {
        priceId: plan.priceId,
        productId: plan.productId,
        name: plan.name,
        priceType: "fixed_recurring",
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        billingIntervalCount: plan.billingIntervalCount,
        unitAmount: plan.unitAmount,
      },
    });

    handleCatalogResult(priceResult, `price ${plan.priceId}`);
    seededPriceMap[plan.lookupKey] = plan.priceId;
    console.log(`${plan.lookupKey}=${plan.priceId}`);
  }

  console.log("VORTEX_BILLING_SAAS_PRICE_MAP=");
  console.log(JSON.stringify(seededPriceMap, null, 2));
}

function handleCatalogResult(result: CatalogMutationResult, label: string): void {
  const { data, error, response } = result;

  if (response?.status === 409) {
    console.log(`Skipping existing ${label} (HTTP 409)`);
    return;
  }

  if (error !== undefined || response === undefined || !response.ok) {
    const status = response?.status ?? "no-response";
    throw new Error(`Vortex Billing seed failed for ${label} (${status}): ${summarize(error ?? data)}`);
  }
}

function validateOperatorEditedPlans(plans: readonly SeedPlanDefinition[]): void {
  const placeholderPlans = plans.filter((plan) => plan.unitAmount === 0);

  if (placeholderPlans.length > 0) {
    const lookupKeys = placeholderPlans.map((plan) => plan.lookupKey).join(", ");
    throw new Error(`Set real unitAmount values before seeding Vortex Billing: ${lookupKeys}`);
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function summarize(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message.length > 0 ? `${value.name}: ${value.message}` : value.name;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "unreadable response";
  }
}

await main();
