/*
 * One-time Vortex Billing SaaS catalog seed.
 *
 * Run manually with Bun/Node and VORTEX_BILLING_API_BASE_URL +
 * VORTEX_BILLING_API_KEY set. Never run this in CI.
 *
 * Seeds the sandbox/prod Vortex Billing catalog entries Seal SaaS expects:
 * - one Seal Professional product
 * - monthly and yearly recurring prices
 * - lookupKey metadata mirrored into VORTEX_BILLING_SAAS_PRICE_MAP
 */

import { createClient, createProduct, createPrice } from "@vortexnyc/payments-sdk";

type BillingCurrency = "USD" | "CAD";
type BillingInterval = "day" | "week" | "month" | "year";

type SeedProductDefinition = {
  readonly productId: string;
  readonly name: string;
  readonly description: string;
  readonly metadata: Readonly<Record<string, string>>;
};

type SeedPlanDefinition = {
  readonly lookupKey: string;
  readonly priceId: string;
  readonly name: string;
  readonly currency: BillingCurrency;
  readonly billingInterval: BillingInterval;
  readonly billingIntervalCount: number;
  readonly unitAmount: number;
};

const SEAL_SAAS_PRODUCT = {
  productId: "vtx_prod_seal_professional",
  name: "Seal Professional",
  description: "Advanced workspace, API, and automation features.",
  metadata: {
    tier: "pro",
    useType: "business",
    features: "api_access,webhook_access",
  },
} as const satisfies SeedProductDefinition;

const SEAL_SAAS_PLANS = [
  {
    lookupKey: "pro:monthly:v2",
    priceId: "vtx_price_seal_pro_monthly_v2",
    name: "Seal Professional Monthly",
    currency: "USD",
    billingInterval: "month",
    billingIntervalCount: 1,
    unitAmount: 1900,
  },
  {
    lookupKey: "pro:yearly:v2",
    priceId: "vtx_price_seal_pro_yearly_v2",
    name: "Seal Professional Yearly",
    currency: "USD",
    billingInterval: "year",
    billingIntervalCount: 1,
    unitAmount: 18000,
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

  const productResult = await createProduct({
    client,
    headers: { "Idempotency-Key": `seal-saas-product:${SEAL_SAAS_PRODUCT.productId}` },
    body: {
      productId: SEAL_SAAS_PRODUCT.productId,
      name: SEAL_SAAS_PRODUCT.name,
      description: SEAL_SAAS_PRODUCT.description,
      metadata: SEAL_SAAS_PRODUCT.metadata,
    },
  });

  handleCatalogResult(productResult, `product ${SEAL_SAAS_PRODUCT.productId}`);

  for (const plan of SEAL_SAAS_PLANS) {
    const priceResult = await createPrice({
      client,
      headers: { "Idempotency-Key": `seal-saas-price:${plan.priceId}` },
      body: {
        priceId: plan.priceId,
        productId: SEAL_SAAS_PRODUCT.productId,
        name: plan.name,
        priceType: "fixed_recurring",
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        billingIntervalCount: plan.billingIntervalCount,
        unitAmount: plan.unitAmount,
        metadata: {
          lookupKey: plan.lookupKey,
        },
      },
    });

    handleCatalogResult(priceResult, `price ${plan.priceId}`);
    seededPriceMap[plan.lookupKey] = plan.priceId;
    console.info(`${plan.lookupKey}=${plan.priceId}`);
  }

  console.info("VORTEX_BILLING_SAAS_PRICE_MAP=");
  console.info(JSON.stringify(seededPriceMap, null, 2));
}

function handleCatalogResult(result: CatalogMutationResult, label: string): void {
  const { data, error, response } = result;

  if (response?.status === 409) {
    console.info(`Skipping existing ${label} (HTTP 409)`);
    return;
  }

  if (error !== undefined || response === undefined || !response.ok) {
    const status = response?.status ?? "no-response";
    throw new Error(
      `Vortex Billing seed failed for ${label} (${status}): ${summarize(error ?? data)}`,
    );
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
