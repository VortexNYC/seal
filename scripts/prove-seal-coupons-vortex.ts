#!/usr/bin/env bun

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

type ProofOrganization = {
  readonly label: "discounted" | "invalid" | "normal";
  readonly organizationId: string;
  readonly customerExternalId: string;
  readonly subscriptionExternalId: string;
  readonly billingAccountId: string;
};

type LiveConfig = {
  readonly sealDeployment: string;
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
};

type ProofOrganizations = {
  readonly discountedOrganization: ProofOrganization;
  readonly invalidOrganization: ProofOrganization;
  readonly normalOrganization: ProofOrganization;
};

type ProofPrices = {
  readonly productId: string;
  readonly recurringPriceId: string;
  readonly provisioningPriceId: string;
  readonly unitAmount: number;
};

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const defaultVortexBaseUrl = "https://notable-leopard-969.convex.site";
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const lookupKey = `seal-coupon-proof:${proofRunId}`;
const couponId = `seal_coupon_${proofRunId}`;
const promoCode = `SEAL${proofRunId.toUpperCase().replaceAll("_", "")}`;
const invalidPromoCode = `INVALID${proofRunId.toUpperCase().replaceAll("_", "")}`;
const proofBillingAccountPlaceholder = `bacc_seal_coupon_proof_pending_${proofRunId}`;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function warnAndSkip(missing: readonly string[]): never {
  console.warn("Skipping Seal coupons-to-Vortex live proof.");
  console.warn("Missing required live-proof configuration:");
  for (const name of missing) {
    console.warn(`- ${name}`);
  }
  process.exit(0);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function isJsonObject(value: Json): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function objectFromJson(value: Json, label: string): JsonObject {
  assert(isJsonObject(value), `Expected ${label} to be an object`);
  return value;
}

function objectField(value: JsonObject, field: string): JsonObject {
  const child = value[field];
  assert(isJsonObject(child), `Expected ${field} to be an object`);
  return child;
}

function arrayField(value: JsonObject, field: string): readonly Json[] {
  const child = value[field];
  assert(Array.isArray(child), `Expected ${field} to be an array`);
  return child;
}

function stringField(value: JsonObject, field: string): string {
  const child = value[field];
  assert(
    typeof child === "string" && child.length > 0,
    `Expected ${field} to be a string`
  );
  return child;
}

function numberField(value: JsonObject, field: string): number {
  const child = value[field];
  assert(
    typeof child === "number" && Number.isFinite(child),
    `Expected ${field} to be a number`
  );
  return child;
}

function urlWithoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function runCommand(input: {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly deployment: string;
}): Promise<CommandResult> {
  const child = Bun.spawn([...input.command], {
    cwd: input.cwd,
    env: { ...process.env, CONVEX_DEPLOYMENT: input.deployment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function runConvex<T extends Json>(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<T> {
  const result = await runCommand({
    command: [
      "bunx",
      "convex",
      "run",
      "--typecheck=disable",
      "--codegen=disable",
      input.functionName,
      JSON.stringify(input.args),
    ],
    cwd: sealConvexCwd,
    deployment: input.deployment,
  });
  if (result.exitCode !== 0) {
    fail(
      `convex run ${input.functionName} failed\n${result.stderr}\n${result.stdout}`
    );
  }
  return parseConvexJson<T>(result.stdout, input.functionName);
}

async function getConvexEnv(input: {
  readonly deployment: string;
  readonly name: string;
}): Promise<string | undefined> {
  const result = await runCommand({
    command: ["bunx", "convex", "env", "get", input.name],
    cwd: sealConvexCwd,
    deployment: input.deployment,
  });
  if (result.exitCode !== 0) {
    return undefined;
  }
  const value = result.stdout.trim();
  return value.length > 0 ? value : undefined;
}

async function runConvexExpectFailure(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<CommandResult> {
  const result = await runCommand({
    command: [
      "bunx",
      "convex",
      "run",
      "--typecheck=disable",
      "--codegen=disable",
      input.functionName,
      JSON.stringify(input.args),
    ],
    cwd: sealConvexCwd,
    deployment: input.deployment,
  });
  assert(
    result.exitCode !== 0,
    `Expected convex run ${input.functionName} to fail`
  );
  return result;
}

function parseConvexJson<T extends Json>(
  stdout: string,
  functionName: string
): T {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(jsonStart >= 0, `No JSON returned from ${functionName}: ${trimmed}`);
  return JSON.parse(trimmed.slice(jsonStart)) as T;
}

async function setConvexEnv(input: {
  readonly deployment: string;
  readonly name: string;
  readonly value: string;
}): Promise<void> {
  const result = await runCommand({
    command: ["bunx", "convex", "env", "set", input.name, input.value],
    cwd: sealConvexCwd,
    deployment: input.deployment,
  });
  if (result.exitCode !== 0) {
    fail(
      `convex env set ${input.name} failed\n${result.stderr}\n${result.stdout}`
    );
  }
}

function readStringRecord(
  value: string | undefined,
  label: string
): Record<string, string> {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }
  const parsed = JSON.parse(value) as Json;
  assert(isJsonObject(parsed), `Expected ${label} to be a JSON object`);
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    assert(
      typeof entry === "string",
      `Expected ${label}.${key} to be a string`
    );
    record[key] = entry;
  }
  return record;
}

async function mergeConvexStringRecordEnv(input: {
  readonly deployment: string;
  readonly name: string;
  readonly updates: Readonly<Record<string, string>>;
}): Promise<void> {
  const existing = readStringRecord(
    await getConvexEnv({ deployment: input.deployment, name: input.name }),
    input.name
  );
  await setConvexEnv({
    deployment: input.deployment,
    name: input.name,
    value: JSON.stringify({ ...existing, ...input.updates }),
  });
}

async function requestVortexJson(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly method?: "GET" | "POST" | "PUT";
  readonly path: string;
  readonly body?: JsonObject;
  readonly idempotencyKey?: string;
  readonly label: string;
}): Promise<JsonObject> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.apiKey}`,
    "x-vortex-service": "billing",
  };
  if (input.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (input.idempotencyKey !== undefined) {
    headers["idempotency-key"] = input.idempotencyKey;
  }

  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method ?? "GET",
    headers,
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  });
  const text = await response.text();
  const parsed = objectFromJson(
    text.length > 0 ? (JSON.parse(text) as Json) : null,
    `${input.label} response`
  );
  if (!response.ok) {
    fail(
      `${input.label} failed: ${response.status}\n${JSON.stringify(parsed, null, 2)}`
    );
  }
  return parsed;
}

async function createProofProduct(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
}): Promise<string> {
  const productBody = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "POST",
    path: "/v1/products",
    idempotencyKey: `seal_coupon_product_${proofRunId}`,
    label: "POST /v1/products",
    body: {
      productId: `vtx_prod_seal_coupon_proof_${proofRunId}`,
      name: "Seal coupon proof recurring product",
      description: "Recurring product created by Seal coupons-to-Vortex proof",
      metadata: {
        proof: "seal-coupons-vortex",
        proofRunId,
        tier: "pro",
        useType: "business",
        features: "api_access,webhook_access,team_members",
      },
    },
  });
  const product = objectField(objectField(productBody, "data"), "product");
  return stringField(product, "productId");
}

async function createRecurringProofPrice(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly productId: string;
}): Promise<JsonObject> {
  const priceBody = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "POST",
    path: "/v1/prices",
    idempotencyKey: `seal_coupon_price_${proofRunId}`,
    label: "POST /v1/prices",
    body: {
      priceId: `vtx_price_seal_coupon_proof_${proofRunId}`,
      productId: input.productId,
      name: "Seal coupon proof monthly price",
      priceType: "fixed_recurring",
      currency: "USD",
      unitAmount: 5000,
      billingInterval: "month",
      billingIntervalCount: 1,
      metadata: {
        proof: "seal-coupons-vortex",
        proofRunId,
      },
    },
  });
  const price = objectField(objectField(priceBody, "data"), "price");

  assert(
    stringField(price, "productId") === input.productId,
    "Expected created price product id"
  );
  assert(
    stringField(price, "priceType") === "fixed_recurring",
    "Expected fixed_recurring proof price"
  );
  assert(stringField(price, "currency") === "USD", "Expected USD proof price");
  assert(
    stringField(price, "billingInterval") === "month",
    "Expected monthly proof price"
  );
  assert(
    numberField(price, "billingIntervalCount") === 1,
    "Expected one-month proof price interval count"
  );
  assert(
    numberField(price, "unitAmount") === 5000,
    "Expected proof price unit amount"
  );
  return price;
}

async function createProvisioningProofPrice(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly productId: string;
}): Promise<JsonObject> {
  const oneTimePriceBody = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "POST",
    path: "/v1/prices",
    idempotencyKey: `seal_coupon_one_time_price_${proofRunId}`,
    label: "POST /v1/prices one-time provisioning",
    body: {
      priceId: `vtx_price_seal_coupon_provision_${proofRunId}`,
      productId: input.productId,
      name: "Seal coupon proof one-time provisioning price",
      priceType: "fixed_one_time",
      currency: "USD",
      unitAmount: 5000,
      metadata: {
        proof: "seal-coupons-vortex",
        proofRunId,
        purpose: "billing-account-provisioning",
      },
    },
  });
  const oneTimePrice = objectField(
    objectField(oneTimePriceBody, "data"),
    "price"
  );

  assert(
    stringField(oneTimePrice, "productId") === input.productId,
    "Expected created one-time price product id"
  );
  assert(
    stringField(oneTimePrice, "priceType") === "fixed_one_time",
    "Expected fixed_one_time proof price"
  );
  assert(
    stringField(oneTimePrice, "currency") === "USD",
    "Expected USD one-time proof price"
  );
  assert(
    numberField(oneTimePrice, "unitAmount") === 5000,
    "Expected one-time proof price unit amount"
  );
  return oneTimePrice;
}

async function createProofPrices(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
}): Promise<ProofPrices> {
  const productId = await createProofProduct(input);
  const price = await createRecurringProofPrice({ ...input, productId });
  const oneTimePrice = await createProvisioningProofPrice({
    ...input,
    productId,
  });

  return {
    productId,
    recurringPriceId: stringField(price, "priceId"),
    provisioningPriceId: stringField(oneTimePrice, "priceId"),
    unitAmount: numberField(price, "unitAmount"),
  };
}

async function createProofCoupon(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly priceId: string;
}): Promise<void> {
  const body = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "POST",
    path: "/v1/coupons",
    idempotencyKey: `seal_coupon_create_${proofRunId}`,
    label: "POST /v1/coupons",
    body: {
      couponId,
      code: promoCode,
      name: "Seal Vortex checkout proof discount",
      discountType: "percentage",
      percentage: 25,
      duration: "once",
      reusable: true,
      targets: { priceIds: [input.priceId] },
      metadata: {
        proof: "seal-coupons-vortex",
        proofRunId,
      },
    },
  });
  const coupon = objectField(objectField(body, "data"), "coupon");
  assert(
    stringField(coupon, "couponId") === couponId,
    "Expected created coupon id"
  );
}

async function ensureSealProofOrganization(input: {
  readonly deployment: string;
  readonly label: ProofOrganization["label"];
}): Promise<string> {
  const body = await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName:
      "vortex_billing/proof_actions:ensureSealVortexOnboardingProofOrganization",
    args: {
      proofRunId: `${proofRunId}_${input.label}`,
    },
  });
  return stringField(body, "organizationId");
}

async function resolveProofRefs(input: {
  readonly deployment: string;
  readonly organizationId: string;
  readonly priceId: string;
  readonly apiBaseUrl: string;
  readonly apiKey: string;
}): Promise<
  Pick<ProofOrganization, "customerExternalId" | "subscriptionExternalId">
> {
  const body = await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName:
      "vortex_billing/proof_actions:resolveVortexSaasBillingProofRefs",
    args: {
      organizationId: input.organizationId,
      lookupKey,
      priceId: input.priceId,
      billingAccountId: proofBillingAccountPlaceholder,
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
    },
  });
  return {
    customerExternalId: stringField(body, "customerExternalId"),
    subscriptionExternalId: stringField(body, "subscriptionExternalId"),
  };
}

async function upsertVortexCustomer(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly organization: Pick<
    ProofOrganization,
    "label" | "organizationId" | "customerExternalId"
  >;
}): Promise<void> {
  const body = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "PUT",
    path: `/v1/customers/${encodeURIComponent(input.organization.customerExternalId)}`,
    idempotencyKey: `seal_coupon_customer_${proofRunId}_${input.organization.label}`,
    label: "PUT /v1/customers/:customerExternalId",
    body: {
      name: `Seal coupon proof ${input.organization.label}`,
      email: `seal-coupon-${input.organization.label}+${proofRunId}@seal.test`,
      billingCurrency: "USD",
      timezone: "UTC",
      metadata: {
        proof: "seal-coupons-vortex",
        proofRunId,
        sealOrganizationId: input.organization.organizationId,
      },
    },
  });
  const customer = objectField(objectField(body, "data"), "customer");
  assert(
    stringField(customer, "customerExternalId") ===
      input.organization.customerExternalId,
    "Expected upserted Vortex customer external id"
  );
}

async function provisionBillingAccountViaCheckout(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly organization: Pick<
    ProofOrganization,
    "label" | "organizationId" | "customerExternalId"
  >;
  readonly priceId: string;
}): Promise<string> {
  const body = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "POST",
    path: "/v1/checkout/sessions",
    idempotencyKey: `seal_coupon_account_${proofRunId}_${input.organization.label}`,
    label: "POST /v1/checkout/sessions account provisioning",
    body: {
      mode: "payment",
      customerExternalId: input.organization.customerExternalId,
      collectionMode: "automatic",
      lineItems: [
        {
          priceId: input.priceId,
          quantity: 1,
          metadata: {
            proof: "seal-coupons-vortex",
            purpose: "billing-account-provisioning",
          },
        },
      ],
      createdByRef: "seal-coupons-vortex-proof",
      metadata: {
        proof: "seal-coupons-vortex",
        proofRunId,
        sealOrganizationId: input.organization.organizationId,
        purpose: "billing-account-provisioning",
      },
    },
  });
  const checkoutSession = objectField(
    objectField(body, "data"),
    "checkoutSession"
  );
  assert(
    stringField(checkoutSession, "customerExternalId") ===
      input.organization.customerExternalId,
    "Expected provisioning checkout customer external id"
  );
  return stringField(checkoutSession, "billingAccountId");
}

async function prepareProofOrganization(input: {
  readonly deployment: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly priceId: string;
  readonly provisioningPriceId: string;
  readonly label: ProofOrganization["label"];
}): Promise<ProofOrganization> {
  const organizationId = await ensureSealProofOrganization({
    deployment: input.deployment,
    label: input.label,
  });
  const refs = await resolveProofRefs({
    deployment: input.deployment,
    organizationId,
    priceId: input.priceId,
    apiBaseUrl: input.baseUrl,
    apiKey: input.apiKey,
  });
  const withoutAccount = {
    label: input.label,
    organizationId,
    ...refs,
  };
  await upsertVortexCustomer({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    organization: withoutAccount,
  });
  const billingAccountId = await provisionBillingAccountViaCheckout({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    organization: withoutAccount,
    priceId: input.provisioningPriceId,
  });
  return {
    ...withoutAccount,
    billingAccountId,
  };
}

async function listAppliedCouponIds(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly customerExternalId: string;
}): Promise<readonly string[]> {
  const body = await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "GET",
    path: `/v1/applied-coupons?customer=${encodeURIComponent(input.customerExternalId)}&status=active`,
    label: "GET /v1/applied-coupons",
  });
  return arrayField(body, "data")
    .filter(isJsonObject)
    .map((appliedCoupon) => stringField(appliedCoupon, "appliedCouponId"));
}

async function createCheckout(input: {
  readonly deployment: string;
  readonly organizationId: string;
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
  readonly billingAccountId: string;
  readonly priceId: string;
  readonly priceUnitAmount: number;
  readonly promoCode?: string;
}): Promise<JsonObject> {
  return await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName:
      "vortex_billing/proof_actions:createVortexSaasCheckoutProofSession",
    args: {
      organizationId: input.organizationId,
      lookupKey,
      quantity: 1,
      priceUnitAmount: input.priceUnitAmount,
      apiBaseUrl: input.vortexBaseUrl,
      apiKey: input.vortexApiKey,
      billingAccountId: input.billingAccountId,
      priceId: input.priceId,
      ...(input.promoCode === undefined ? {} : { promoCode: input.promoCode }),
    },
  });
}

function readLiveConfig(): LiveConfig {
  const sealDeployment =
    readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexBaseUrl = urlWithoutTrailingSlash(
    readEnv("VORTEX_BILLING_API_BASE_URL") ?? defaultVortexBaseUrl
  );
  const vortexApiKey = readEnv("VORTEX_BILLING_API_KEY");
  const missing = vortexApiKey === undefined ? ["VORTEX_BILLING_API_KEY"] : [];
  if (missing.length > 0) {
    warnAndSkip(missing);
  }
  assert(vortexApiKey !== undefined, "Vortex API key is required");
  return { sealDeployment, vortexBaseUrl, vortexApiKey };
}

async function configureSealBillingEnv(
  input: LiveConfig & {
    readonly priceId: string;
  }
): Promise<void> {
  await setConvexEnv({
    deployment: input.sealDeployment,
    name: "VORTEX_BILLING_API_BASE_URL",
    value: input.vortexBaseUrl,
  });
  await setConvexEnv({
    deployment: input.sealDeployment,
    name: "VORTEX_BILLING_API_KEY",
    value: input.vortexApiKey,
  });
  await mergeConvexStringRecordEnv({
    deployment: input.sealDeployment,
    name: "VORTEX_BILLING_SAAS_PRICE_MAP",
    updates: { [lookupKey]: input.priceId },
  });
}

async function prepareProofOrganizations(
  input: LiveConfig & {
    readonly priceId: string;
    readonly provisioningPriceId: string;
  }
): Promise<ProofOrganizations> {
  const discountedOrganization = await prepareProofOrganization({
    deployment: input.sealDeployment,
    baseUrl: input.vortexBaseUrl,
    apiKey: input.vortexApiKey,
    priceId: input.priceId,
    provisioningPriceId: input.provisioningPriceId,
    label: "discounted",
  });
  const invalidOrganization = await prepareProofOrganization({
    deployment: input.sealDeployment,
    baseUrl: input.vortexBaseUrl,
    apiKey: input.vortexApiKey,
    priceId: input.priceId,
    provisioningPriceId: input.provisioningPriceId,
    label: "invalid",
  });
  const normalOrganization = await prepareProofOrganization({
    deployment: input.sealDeployment,
    baseUrl: input.vortexBaseUrl,
    apiKey: input.vortexApiKey,
    priceId: input.priceId,
    provisioningPriceId: input.provisioningPriceId,
    label: "normal",
  });
  await mergeConvexStringRecordEnv({
    deployment: input.sealDeployment,
    name: "VORTEX_BILLING_ACCOUNT_MAP",
    updates: {
      [discountedOrganization.organizationId]:
        discountedOrganization.billingAccountId,
      [invalidOrganization.organizationId]:
        invalidOrganization.billingAccountId,
      [normalOrganization.organizationId]: normalOrganization.billingAccountId,
    },
  });
  return { discountedOrganization, invalidOrganization, normalOrganization };
}

async function proveDiscountedCheckout(input: {
  readonly deployment: string;
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
  readonly priceId: string;
  readonly organization: ProofOrganization;
  readonly unitAmount: number;
}): Promise<JsonObject> {
  const checkout = await createCheckout({
    deployment: input.deployment,
    organizationId: input.organization.organizationId,
    vortexBaseUrl: input.vortexBaseUrl,
    vortexApiKey: input.vortexApiKey,
    billingAccountId: input.organization.billingAccountId,
    priceId: input.priceId,
    priceUnitAmount: input.unitAmount,
    promoCode,
  });
  assert(
    stringField(checkout, "checkoutUrl").length > 0,
    "Expected discounted checkout URL"
  );
  assert(
    numberField(checkout, "amountTotal") < input.unitAmount,
    "Expected discounted checkout amountTotal to be below unitAmount"
  );
  return checkout;
}

async function proveInvalidCodeCreatesNoAppliedCoupon(
  input: LiveConfig & {
    readonly organization: ProofOrganization;
    readonly priceId: string;
    readonly unitAmount: number;
  }
): Promise<number> {
  const beforeInvalidApplied = new Set(
    await listAppliedCouponIds({
      baseUrl: input.vortexBaseUrl,
      apiKey: input.vortexApiKey,
      customerExternalId: input.organization.customerExternalId,
    })
  );
  const invalidResult = await runConvexExpectFailure({
    deployment: input.sealDeployment,
    functionName:
      "vortex_billing/proof_actions:createVortexSaasCheckoutProofSession",
    args: {
      organizationId: input.organization.organizationId,
      lookupKey,
      quantity: 1,
      promoCode: invalidPromoCode,
      priceUnitAmount: input.unitAmount,
      apiBaseUrl: input.vortexBaseUrl,
      apiKey: input.vortexApiKey,
      billingAccountId: input.organization.billingAccountId,
      priceId: input.priceId,
    },
  });
  assert(
    `${invalidResult.stderr}\n${invalidResult.stdout}`.includes(
      "coupon code is invalid or inactive"
    ),
    "Expected invalid code checkout to fail before checkout creation"
  );
  const afterInvalidApplied = await listAppliedCouponIds({
    baseUrl: input.vortexBaseUrl,
    apiKey: input.vortexApiKey,
    customerExternalId: input.organization.customerExternalId,
  });
  const newInvalidApplied = afterInvalidApplied.filter(
    (id) => !beforeInvalidApplied.has(id)
  );
  assert(
    newInvalidApplied.length === 0,
    "Expected invalid code to create no active applied coupon"
  );
  return newInvalidApplied.length;
}

async function proveNormalCheckout(input: {
  readonly deployment: string;
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
  readonly priceId: string;
  readonly organization: ProofOrganization;
  readonly unitAmount: number;
}): Promise<JsonObject> {
  const checkout = await createCheckout({
    deployment: input.deployment,
    organizationId: input.organization.organizationId,
    vortexBaseUrl: input.vortexBaseUrl,
    vortexApiKey: input.vortexApiKey,
    billingAccountId: input.organization.billingAccountId,
    priceId: input.priceId,
    priceUnitAmount: input.unitAmount,
  });
  assert(
    stringField(checkout, "checkoutUrl").length > 0,
    "Expected normal checkout URL"
  );
  assert(
    numberField(checkout, "amountTotal") === input.unitAmount,
    "Expected no-code checkout at full unitAmount"
  );
  return checkout;
}

function printProofResult(
  input: LiveConfig &
    ProofOrganizations & {
      readonly productId: string;
      readonly priceId: string;
      readonly provisioningPriceId: string;
      readonly unitAmount: number;
      readonly discounted: JsonObject;
      readonly normal: JsonObject;
      readonly newInvalidAppliedCoupons: number;
    }
): void {
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_coupons_vortex",
        boundary:
          "Seal -> Vortex public catalog/customers/checkout/coupons/applied-coupons API only",
        sealDeployment: input.sealDeployment,
        vortexBaseUrl: input.vortexBaseUrl,
        proofRunId,
        provisioning: {
          model:
            "public checkout auto-provisions billing accounts after public customer upsert",
          organizations: [
            {
              label: input.discountedOrganization.label,
              organizationId: input.discountedOrganization.organizationId,
              customerExternalId:
                input.discountedOrganization.customerExternalId,
              subscriptionExternalId:
                input.discountedOrganization.subscriptionExternalId,
              billingAccountId: input.discountedOrganization.billingAccountId,
            },
            {
              label: input.invalidOrganization.label,
              organizationId: input.invalidOrganization.organizationId,
              customerExternalId: input.invalidOrganization.customerExternalId,
              subscriptionExternalId:
                input.invalidOrganization.subscriptionExternalId,
              billingAccountId: input.invalidOrganization.billingAccountId,
            },
            {
              label: input.normalOrganization.label,
              organizationId: input.normalOrganization.organizationId,
              customerExternalId: input.normalOrganization.customerExternalId,
              subscriptionExternalId:
                input.normalOrganization.subscriptionExternalId,
              billingAccountId: input.normalOrganization.billingAccountId,
            },
          ],
        },
        price: {
          productId: input.productId,
          priceId: input.priceId,
          provisioningPriceId: input.provisioningPriceId,
          unitAmount: input.unitAmount,
        },
        coupon: {
          couponId,
          promoCode,
        },
        discounted: {
          amountTotal: numberField(input.discounted, "amountTotal"),
          amountRemaining: numberField(input.discounted, "amountRemaining"),
        },
        invalidCode: {
          createdCheckout: false,
          newActiveAppliedCoupons: input.newInvalidAppliedCoupons,
        },
        noCode: {
          amountTotal: numberField(input.normal, "amountTotal"),
        },
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const config = readLiveConfig();
  const prices = await createProofPrices({
    baseUrl: config.vortexBaseUrl,
    apiKey: config.vortexApiKey,
  });
  const { productId, recurringPriceId, provisioningPriceId, unitAmount } =
    prices;

  await createProofCoupon({
    baseUrl: config.vortexBaseUrl,
    apiKey: config.vortexApiKey,
    priceId: recurringPriceId,
  });
  await configureSealBillingEnv({ ...config, priceId: recurringPriceId });
  const organizations = await prepareProofOrganizations({
    ...config,
    priceId: recurringPriceId,
    provisioningPriceId,
  });
  const discounted = await proveDiscountedCheckout({
    deployment: config.sealDeployment,
    vortexBaseUrl: config.vortexBaseUrl,
    vortexApiKey: config.vortexApiKey,
    priceId: recurringPriceId,
    organization: organizations.discountedOrganization,
    unitAmount,
  });
  const newInvalidAppliedCoupons = await proveInvalidCodeCreatesNoAppliedCoupon(
    {
      ...config,
      organization: organizations.invalidOrganization,
      priceId: recurringPriceId,
      unitAmount,
    }
  );
  const normal = await proveNormalCheckout({
    deployment: config.sealDeployment,
    vortexBaseUrl: config.vortexBaseUrl,
    vortexApiKey: config.vortexApiKey,
    priceId: recurringPriceId,
    organization: organizations.normalOrganization,
    unitAmount,
  });

  printProofResult({
    ...config,
    ...organizations,
    productId,
    priceId: recurringPriceId,
    provisioningPriceId,
    unitAmount,
    discounted,
    normal,
    newInvalidAppliedCoupons,
  });
}

await main();
