#!/usr/bin/env bun

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const defaultVortexBaseUrl = "https://notable-leopard-969.convex.site";
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function warnAndSkip(missing: readonly string[]): never {
  console.warn("Skipping Seal catalog-from-Vortex live proof.");
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

function nullableObjectField(value: JsonObject, field: string): JsonObject | null {
  const child = value[field];
  assert(child === null || isJsonObject(child), `Expected ${field} to be an object or null`);
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

function optionalObjectField(value: JsonObject, field: string): JsonObject | undefined {
  const child = value[field];
  if (child === undefined || child === null) {
    return undefined;
  }
  assert(isJsonObject(child), `Expected ${field} to be an object`);
  return child;
}

function urlWithoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function runCommand(input: {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly label: string;
  readonly deployment: string;
}): Promise<string> {
  const child = Bun.spawn(input.command, {
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
  if (exitCode !== 0) {
    fail(`${input.label} failed\n${stderr}\n${stdout}`);
  }
  return stdout;
}

async function runConvex<T extends Json>(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<T> {
  const stdout = await runCommand({
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
    label: `convex run ${input.functionName}`,
    deployment: input.deployment,
  });
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(jsonStart >= 0, `No JSON returned from ${input.functionName}: ${trimmed}`);
  return JSON.parse(trimmed.slice(jsonStart)) as T;
}

async function setConvexEnv(input: {
  readonly deployment: string;
  readonly name: string;
  readonly value: string;
}): Promise<void> {
  await runCommand({
    command: ["bunx", "convex", "env", "set", input.name, input.value],
    cwd: sealConvexCwd,
    label: `convex env set ${input.name}`,
    deployment: input.deployment,
  });
}

async function requestVortexCatalog(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
}): Promise<JsonObject> {
  const response = await fetch(`${input.baseUrl}/v1/catalog`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "x-vortex-service": "billing",
    },
  });
  const text = await response.text();
  const parsed = objectFromJson(
    text.length > 0 ? (JSON.parse(text) as Json) : null,
    "Vortex catalog response",
  );
  if (response.status < 200 || response.status >= 300) {
    fail(`GET /v1/catalog failed: ${response.status}\n${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

function isActiveCatalogRecord(value: Json): value is JsonObject {
  return isJsonObject(value) && (value.archivedAt === undefined || value.archivedAt === null);
}

function selectCatalogPrice(catalog: JsonObject): {
  readonly product: JsonObject;
  readonly price: JsonObject;
} {
  const data = objectField(catalog, "data");
  const products = arrayField(data, "products").filter(isActiveCatalogRecord);
  const prices = arrayField(data, "prices").filter(isActiveCatalogRecord);
  assert(products.length > 0, "Expected Vortex catalog to include at least one active product");
  assert(prices.length > 0, "Expected Vortex catalog to include at least one active price");

  const vortexShaped = findLinkedCatalogPrice(products, prices, (productId, priceId) =>
    productId.startsWith("vtx_") && priceId.startsWith("vtx_"),
  );
  if (vortexShaped !== null) {
    return vortexShaped;
  }

  return findLinkedCatalogPrice(products, prices, () => true) ??
    fail("Expected at least one Vortex catalog price to reference an active product");
}

function findLinkedCatalogPrice(
  products: readonly JsonObject[],
  prices: readonly JsonObject[],
  predicate: (productId: string, priceId: string) => boolean,
): { readonly product: JsonObject; readonly price: JsonObject } | null {
  for (const price of prices) {
    const productId = stringField(price, "productId");
    const priceId = stringField(price, "priceId");
    if (!predicate(productId, priceId)) {
      continue;
    }
    const product = products.find((candidate) => stringField(candidate, "productId") === productId);
    if (product !== undefined) {
      return { product, price };
    }
  }

  return null;
}

function assertPlanPro(state: JsonObject, context: string): void {
  const plan = objectField(state, "plan");
  assert(plan.plan === "pro", `${context}: expected legacy provider control plan to remain pro`);
  assert(plan.isPro === true, `${context}: expected legacy provider control isPro true`);
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexBaseUrl = urlWithoutTrailingSlash(
    readEnv("VORTEX_BILLING_API_BASE_URL") ?? defaultVortexBaseUrl,
  );
  const vortexApiKey = readEnv("VORTEX_BILLING_API_KEY");
  const missing = vortexApiKey === undefined ? ["VORTEX_BILLING_API_KEY"] : [];
  if (missing.length > 0) {
    warnAndSkip(missing);
  }
  assert(vortexApiKey !== undefined, "Vortex API key is required");

  const catalog = await requestVortexCatalog({
    baseUrl: vortexBaseUrl,
    apiKey: vortexApiKey,
  });
  const selected = selectCatalogPrice(catalog);
  const vortexPriceId = stringField(selected.price, "priceId");
  const vortexProductId = stringField(selected.product, "productId");
  const expectedCurrency = stringField(selected.price, "currency").toLowerCase();
  const expectedUnitAmount = numberField(selected.price, "unitAmount");
  const expectedBillingInterval = optionalStringField(selected.price, "billingInterval");

  const legacyProviderSafety = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:seedLegacyProviderEntitlementSafetyProof",
    args: { proofRunId },
  });
  const safetyOrganizationId = stringField(legacyProviderSafety, "organizationId");
  const safetyExternalPriceId = stringField(legacyProviderSafety, "externalPriceId");

  const beforeState = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexSaasBillingProofState",
    args: { organizationId: safetyOrganizationId },
  });
  assertPlanPro(beforeState, "before Vortex catalog sync");

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

  const syncResult = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/catalog_sync:syncCatalogFromVortex",
    args: {},
  });
  assert(syncResult.success === true, "Expected syncCatalogFromVortex success true");

  const catalogPrice = await runConvex<JsonObject | null>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexCatalogProofPrice",
    args: { vortexPriceId },
  });
  assert(catalogPrice !== null, `Expected synced Vortex price row: ${vortexPriceId}`);
  assert(stringField(catalogPrice, "vortexPriceId") === vortexPriceId, "Expected vortexPriceId");
  assert(
    stringField(catalogPrice, "externalPriceId") === vortexPriceId,
    "Expected additive Vortex externalPriceId shadow",
  );
  assert(
    stringField(catalogPrice, "vortexProductId") === vortexProductId,
    "Expected vortexProductId",
  );
  assert(
    stringField(catalogPrice, "currency") === expectedCurrency,
    "Expected normalized currency",
  );
  assert(numberField(catalogPrice, "unitAmount") === expectedUnitAmount, "Expected unitAmount");
  const recurring = optionalObjectField(catalogPrice, "recurring");
  if (expectedBillingInterval !== undefined) {
    assert(recurring !== undefined, "Expected recurring details for recurring Vortex price");
    assert(
      stringField(recurring, "interval") === expectedBillingInterval,
      "Expected billingInterval",
    );
  }

  const afterState = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexSaasBillingProofState",
    args: { organizationId: safetyOrganizationId },
  });
  assertPlanPro(afterState, "after Vortex catalog sync");
  const safetyPrice = nullableObjectField(afterState, "price");
  assert(safetyPrice !== null, "Expected legacy provider safety price after sync");
  assert(
    stringField(safetyPrice, "externalPriceId") === safetyExternalPriceId,
    "Expected legacy provider safety subscription to stay on externalPriceId",
  );
  assert(
    afterState.activeLegacyProviderIdPresent === true,
    "Expected legacy-provider-shaped control IDs to remain active",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_catalog_from_vortex",
        boundary: "Seal -> Vortex public GET /v1/catalog only",
        sealDeployment,
        vortexBaseUrl,
        proofRunId,
        sync: {
          syncedProducts: numberField(syncResult, "syncedProducts"),
          syncedPrices: numberField(syncResult, "syncedPrices"),
          requestId: optionalStringField(syncResult, "requestId"),
        },
        vortexCatalogPrice: {
          vortexProductId,
          vortexPriceId,
          currency: expectedCurrency,
          unitAmount: expectedUnitAmount,
          billingInterval: expectedBillingInterval,
        },
        legacyProviderEntitlementSafety: {
          organizationId: safetyOrganizationId,
          externalPriceId: safetyExternalPriceId,
          plan: "pro",
          activeLegacyProviderIdPresent: true,
        },
      },
      null,
      2,
    ),
  );
}

await main();
