#!/usr/bin/env bun

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const defaultVortexBaseUrl = "https://notable-leopard-969.convex.site";
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const lookupKey = `seal-coupon-proof:${proofRunId}`;
const organizationIdBase = `seal_coupon_proof_${proofRunId}`;
const couponId = `seal_coupon_${proofRunId}`;
const promoCode = `SEAL${proofRunId.toUpperCase().replaceAll("_", "")}`;
const invalidPromoCode = `INVALID${proofRunId.toUpperCase().replaceAll("_", "")}`;

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
  assert(typeof child === "string" && child.length > 0, `Expected ${field} to be a string`);
  return child;
}

function optionalStringField(value: JsonObject, field: string): string | undefined {
  const child = value[field];
  if (child === undefined || child === null) {
    return undefined;
  }
  assert(typeof child === "string" && child.length > 0, `Expected ${field} to be a string`);
  return child;
}

function numberField(value: JsonObject, field: string): number {
  const child = value[field];
  assert(typeof child === "number" && Number.isFinite(child), `Expected ${field} to be a number`);
  return child;
}

function urlWithoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function sealCustomerExternalId(organizationId: string): string {
  return `vtx_cust_seal_org_${organizationId}`;
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
    fail(`convex run ${input.functionName} failed\n${result.stderr}\n${result.stdout}`);
  }
  return parseConvexJson<T>(result.stdout, input.functionName);
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
  assert(result.exitCode !== 0, `Expected convex run ${input.functionName} to fail`);
  return result;
}

function parseConvexJson<T extends Json>(stdout: string, functionName: string): T {
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
    fail(`convex env set ${input.name} failed\n${result.stderr}\n${result.stdout}`);
  }
}

async function requestVortexJson(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly method?: "GET" | "POST";
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
    `${input.label} response`,
  );
  if (!response.ok) {
    fail(`${input.label} failed: ${response.status}\n${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

async function requestVortexCatalog(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
}): Promise<JsonObject> {
  return await requestVortexJson({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    method: "GET",
    path: "/v1/catalog",
    label: "GET /v1/catalog",
  });
}

function isActiveCatalogRecord(value: Json): value is JsonObject {
  return isJsonObject(value) && (value.archivedAt === undefined || value.archivedAt === null);
}

function selectRecurringCatalogPrice(catalog: JsonObject): JsonObject {
  const data = objectField(catalog, "data");
  const prices = arrayField(data, "prices").filter(isActiveCatalogRecord);
  const price = prices.find((candidate) => optionalStringField(candidate, "billingInterval") !== undefined);
  assert(price !== undefined, "Expected Vortex catalog to include at least one active recurring price");
  numberField(price, "unitAmount");
  return price;
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
  assert(stringField(coupon, "couponId") === couponId, "Expected created coupon id");
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
  readonly priceUnitAmount: number;
  readonly promoCode?: string;
}): Promise<JsonObject> {
  return await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName: "vortex_billing/proof_actions:createVortexSaasCheckoutProofSession",
    args: {
      organizationId: input.organizationId,
      lookupKey,
      quantity: 1,
      priceUnitAmount: input.priceUnitAmount,
      ...(input.promoCode === undefined ? {} : { promoCode: input.promoCode }),
    },
  });
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexBaseUrl = urlWithoutTrailingSlash(
    readEnv("VORTEX_BILLING_API_BASE_URL") ?? defaultVortexBaseUrl,
  );
  const vortexApiKey = readEnv("VORTEX_BILLING_API_KEY");
  const billingAccountId = readEnv("VORTEX_BILLING_ACCOUNT_ID");
  const missing = [
    ...(vortexApiKey === undefined ? ["VORTEX_BILLING_API_KEY"] : []),
    ...(billingAccountId === undefined ? ["VORTEX_BILLING_ACCOUNT_ID"] : []),
  ];
  if (missing.length > 0) {
    warnAndSkip(missing);
  }
  assert(vortexApiKey !== undefined, "Vortex API key is required");
  assert(billingAccountId !== undefined, "Vortex billing account id is required");

  const catalog = await requestVortexCatalog({ baseUrl: vortexBaseUrl, apiKey: vortexApiKey });
  const price = selectRecurringCatalogPrice(catalog);
  const priceId = stringField(price, "priceId");
  const unitAmount = numberField(price, "unitAmount");

  await createProofCoupon({ baseUrl: vortexBaseUrl, apiKey: vortexApiKey, priceId });
  await setConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_API_BASE_URL",
    value: vortexBaseUrl,
  });
  await setConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_API_KEY",
    value: vortexApiKey,
  });
  await setConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_ACCOUNT_ID",
    value: billingAccountId,
  });
  await setConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_SAAS_PRICE_MAP",
    value: JSON.stringify({ [lookupKey]: priceId }),
  });

  const discounted = await createCheckout({
    deployment: sealDeployment,
    organizationId: `${organizationIdBase}_discounted`,
    priceUnitAmount: unitAmount,
    promoCode,
  });
  assert(stringField(discounted, "checkoutUrl").length > 0, "Expected discounted checkout URL");
  assert(
    numberField(discounted, "amountTotal") < unitAmount,
    "Expected discounted checkout amountTotal to be below unitAmount",
  );

  const invalidOrganizationId = `${organizationIdBase}_invalid`;
  const invalidCustomerExternalId = sealCustomerExternalId(invalidOrganizationId);
  const beforeInvalidApplied = new Set(
    await listAppliedCouponIds({
      baseUrl: vortexBaseUrl,
      apiKey: vortexApiKey,
      customerExternalId: invalidCustomerExternalId,
    }),
  );
  const invalidResult = await runConvexExpectFailure({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:createVortexSaasCheckoutProofSession",
    args: {
      organizationId: invalidOrganizationId,
      lookupKey,
      quantity: 1,
      promoCode: invalidPromoCode,
      priceUnitAmount: unitAmount,
    },
  });
  assert(
    `${invalidResult.stderr}\n${invalidResult.stdout}`.includes("coupon code is invalid or inactive"),
    "Expected invalid code checkout to fail before checkout creation",
  );
  const afterInvalidApplied = await listAppliedCouponIds({
    baseUrl: vortexBaseUrl,
    apiKey: vortexApiKey,
    customerExternalId: invalidCustomerExternalId,
  });
  const newInvalidApplied = afterInvalidApplied.filter((id) => !beforeInvalidApplied.has(id));
  assert(newInvalidApplied.length === 0, "Expected invalid code to create no active applied coupon");

  const normal = await createCheckout({
    deployment: sealDeployment,
    organizationId: `${organizationIdBase}_normal`,
    priceUnitAmount: unitAmount,
  });
  assert(stringField(normal, "checkoutUrl").length > 0, "Expected normal checkout URL");
  assert(numberField(normal, "amountTotal") === unitAmount, "Expected no-code checkout at full unitAmount");

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_coupons_vortex",
        boundary: "Seal -> Vortex public coupons/applied-coupons/catalog API only",
        sealDeployment,
        vortexBaseUrl,
        proofRunId,
        price: {
          priceId,
          unitAmount,
        },
        coupon: {
          couponId,
          promoCode,
        },
        discounted: {
          amountTotal: numberField(discounted, "amountTotal"),
          amountRemaining: numberField(discounted, "amountRemaining"),
        },
        invalidCode: {
          createdCheckout: false,
          newActiveAppliedCoupons: newInvalidApplied.length,
        },
        noCode: {
          amountTotal: numberField(normal, "amountTotal"),
        },
      },
      null,
      2,
    ),
  );
}

await main();
