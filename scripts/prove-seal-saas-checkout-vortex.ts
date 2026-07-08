#!/usr/bin/env bun

import { resolve } from "node:path";

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

type ProofConfig = {
  readonly sealDeployment: string;
  readonly vortexDeployment: string;
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
  readonly organizationId: string;
  readonly billingAccountId: string;
  readonly priceId: string;
};

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const localVortexRepoRoot =
  readEnv("VORTEX_PAYMENTS_REPO_ROOT") ??
  new URL("../../vortex-payments", import.meta.url).pathname;
const vortexConvexCwd = resolve(localVortexRepoRoot, "apps/backend");
const defaultVortexDeployment = "dev:notable-leopard-969";
const defaultVortexBaseUrl = "https://notable-leopard-969.convex.site";
const lookupKey = "pro:monthly:v2";
const expectedUnitAmount = 1900;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
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

function objectField(value: JsonObject, field: string): JsonObject {
  const child = value[field];
  assert(isJsonObject(child), `Expected ${field} to be an object`);
  return child;
}

function stringField(value: JsonObject, field: string): string {
  const child = value[field];
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

async function runConvexResult(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<CommandResult> {
  return await runCommand({
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
}

async function runVortexConvex<T extends Json>(input: {
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
    cwd: vortexConvexCwd,
    deployment: input.deployment,
  });
  if (result.exitCode !== 0) {
    fail(`vortex convex run ${input.functionName} failed\n${result.stderr}\n${result.stdout}`);
  }
  return parseConvexJson<T>(result.stdout, input.functionName);
}

function parseConvexJson<T extends Json>(stdout: string, functionName: string): T {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(jsonStart >= 0, `No JSON returned from ${functionName}: ${trimmed}`);
  return JSON.parse(trimmed.slice(jsonStart)) as T;
}

function readStringRecord(value: string | undefined, label: string): Record<string, string> {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }
  const parsed = JSON.parse(value) as Json;
  assert(isJsonObject(parsed), `Expected ${label} to be a JSON object`);
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    assert(typeof entry === "string", `Expected ${label}.${key} to be a string`);
    record[key] = entry;
  }
  return record;
}

async function mergeSealStringRecordEnv(input: {
  readonly deployment: string;
  readonly name: string;
  readonly updates: Readonly<Record<string, string>>;
}): Promise<Record<string, string>> {
  const existing = readStringRecord(
    await getConvexEnv({ deployment: input.deployment, name: input.name }),
    input.name,
  );
  const next = { ...existing, ...input.updates };
  await setConvexEnv({
    deployment: input.deployment,
    name: input.name,
    value: JSON.stringify(next),
  });
  return next;
}

function readStringArray(value: string | undefined, label: string): readonly string[] {
  assert(value !== undefined && value.trim().length > 0, `${label} is missing`);
  assert(value.trim() !== "*", `${label}=* requires SEAL_VORTEX_PROOF_ORGANIZATION_ID`);
  const parsed = JSON.parse(value) as Json;
  assert(Array.isArray(parsed), `Expected ${label} to be a JSON string array`);
  const entries = parsed.map((entry, index) => {
    assert(
      typeof entry === "string" && entry.length > 0,
      `Expected ${label}[${index}] to be a string`,
    );
    return entry;
  });
  return entries;
}

function selectMappedProofOrganization(input: {
  readonly explicitOrganizationId: string | undefined;
  readonly allowlistedOrganizationIds: readonly string[];
  readonly accountMap: Readonly<Record<string, string>>;
  readonly defaultBillingAccountId: string | undefined;
}): { readonly organizationId: string; readonly billingAccountId: string } | null {
  if (input.explicitOrganizationId !== undefined) {
    const billingAccountId =
      input.accountMap[input.explicitOrganizationId] ?? input.defaultBillingAccountId;
    if (billingAccountId === undefined) {
      return null;
    }
    return { organizationId: input.explicitOrganizationId, billingAccountId };
  }

  for (const organizationId of input.allowlistedOrganizationIds) {
    const billingAccountId = input.accountMap[organizationId] ?? input.defaultBillingAccountId;
    if (billingAccountId !== undefined) {
      return { organizationId, billingAccountId };
    }
  }

  return null;
}

function selectOrganizationForProvisioning(input: {
  readonly explicitOrganizationId: string | undefined;
  readonly allowlistedOrganizationIds: readonly string[];
}): string {
  const organizationId = input.explicitOrganizationId ?? input.allowlistedOrganizationIds[0];
  assert(organizationId !== undefined, "No allowlisted organization available for checkout proof");
  return organizationId;
}

function vortexCustomerExternalIdForSealOrganization(organizationId: string): string {
  return `vtx_cust_seal_org_${organizationId}`;
}

function billingAccountIdForSealOrganization(organizationId: string): string {
  return `bacc_seal_saas_${organizationId}`;
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
  const parsed = objectField(
    { response: text.length > 0 ? (JSON.parse(text) as Json) : null },
    "response",
  );
  if (!response.ok) {
    fail(`${input.label} failed: ${response.status}\n${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

async function resolveVortexApiKeyContext(input: {
  readonly deployment: string;
  readonly apiKey: string;
}): Promise<{ readonly organizationId: string; readonly environment: "sandbox" | "production" }> {
  const resolved = await runVortexConvex<JsonObject>({
    deployment: input.deployment,
    functionName: "auth:resolveApiKey",
    args: { presentedKey: input.apiKey },
  });
  assert(isJsonObject(resolved), "Vortex API key did not resolve");
  const environment = stringField(resolved, "environment");
  assert(
    environment === "sandbox" || environment === "production",
    `Unexpected Vortex API key environment: ${environment}`,
  );
  return {
    organizationId: stringField(resolved, "organizationId"),
    environment,
  };
}

async function provisionMappedBillingAccount(input: {
  readonly sealDeployment: string;
  readonly vortexDeployment: string;
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
  readonly organizationId: string;
}): Promise<string> {
  const vortexContext = await resolveVortexApiKeyContext({
    deployment: input.vortexDeployment,
    apiKey: input.vortexApiKey,
  });
  const customerExternalId = vortexCustomerExternalIdForSealOrganization(input.organizationId);
  const billingAccountId = billingAccountIdForSealOrganization(input.organizationId);

  await requestVortexJson({
    baseUrl: input.vortexBaseUrl,
    apiKey: input.vortexApiKey,
    method: "PUT",
    path: `/v1/customers/${encodeURIComponent(customerExternalId)}`,
    idempotencyKey: `seal_saas_checkout_customer_${input.organizationId}`,
    label: "PUT /v1/customers/:customerExternalId",
    body: {
      name: "Seal SaaS checkout proof customer",
      email: `seal-saas-checkout+${input.organizationId}@seal.test`,
      billingCurrency: "USD",
      timezone: "UTC",
      metadata: {
        proof: "seal-saas-checkout-vortex",
        sealOrganizationId: input.organizationId,
      },
    },
  });

  await runVortexConvex<JsonObject>({
    deployment: input.vortexDeployment,
    functionName: "billingEngine:createBillingAccount",
    args: {
      organizationId: vortexContext.organizationId,
      environment: vortexContext.environment,
      billingAccountId,
      customerId: customerExternalId,
      merchantAccountId: "ma_seal_saas_checkout_proof",
      invoiceDeliveryMode: "api_only",
      collectionMode: "automatic",
      autoCollectionEnabled: true,
      renewalTiming: "advance",
      metadata: {
        proof: "seal-saas-checkout-vortex",
        sealOrganizationId: input.organizationId,
      },
    },
  });

  await mergeSealStringRecordEnv({
    deployment: input.sealDeployment,
    name: "VORTEX_BILLING_ACCOUNT_MAP",
    updates: { [input.organizationId]: billingAccountId },
  });
  return billingAccountId;
}

async function readProofConfig(): Promise<ProofConfig> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexDeployment = readEnv("VORTEX_CONVEX_DEPLOYMENT") ?? defaultVortexDeployment;
  const vortexBaseUrl = urlWithoutTrailingSlash(
    readEnv("VORTEX_BILLING_API_BASE_URL") ??
      (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_API_BASE_URL" })) ??
      defaultVortexBaseUrl,
  );
  const vortexApiKey =
    readEnv("VORTEX_BILLING_API_KEY") ??
    (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_API_KEY" }));
  assert(vortexApiKey !== undefined, "VORTEX_BILLING_API_KEY is missing");

  const explicitOrganizationId = readEnv("SEAL_VORTEX_PROOF_ORGANIZATION_ID");
  const allowlist = await getConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
  });
  const allowlistedOrganizationIds = readStringArray(
    allowlist,
    "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
  );
  assert(
    allowlistedOrganizationIds.length > 0,
    "No allowlisted organization available for checkout proof",
  );

  const accountMap = readStringRecord(
    await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_ACCOUNT_MAP" }),
    "VORTEX_BILLING_ACCOUNT_MAP",
  );
  const defaultBillingAccountId =
    readEnv("VORTEX_BILLING_ACCOUNT_ID") ??
    (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_ACCOUNT_ID" }));

  const priceMap = readStringRecord(
    await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_SAAS_PRICE_MAP" }),
    "VORTEX_BILLING_SAAS_PRICE_MAP",
  );
  const priceId = priceMap[lookupKey];
  assert(priceId !== undefined, `VORTEX_BILLING_SAAS_PRICE_MAP is missing ${lookupKey}`);

  const selected = selectMappedProofOrganization({
    explicitOrganizationId,
    allowlistedOrganizationIds,
    accountMap,
    defaultBillingAccountId,
  }) ?? {
    organizationId: selectOrganizationForProvisioning({
      explicitOrganizationId,
      allowlistedOrganizationIds,
    }),
    billingAccountId: "",
  };
  const billingAccountId =
    selected.billingAccountId.length > 0
      ? selected.billingAccountId
      : await provisionMappedBillingAccount({
          sealDeployment,
          vortexDeployment,
          vortexBaseUrl,
          vortexApiKey,
          organizationId: selected.organizationId,
        });

  return {
    sealDeployment,
    vortexDeployment,
    vortexBaseUrl,
    vortexApiKey,
    organizationId: selected.organizationId,
    billingAccountId,
    priceId,
  };
}

async function createCheckoutProofSession(config: ProofConfig): Promise<JsonObject> {
  const functionName = "vortex_billing/proof_actions:createVortexSaasCheckoutProofSession";
  const baseArgs = {
    organizationId: config.organizationId,
    lookupKey,
    quantity: 1,
    priceUnitAmount: expectedUnitAmount,
  };
  const explicitConfigArgs = {
    ...baseArgs,
    apiBaseUrl: config.vortexBaseUrl,
    apiKey: config.vortexApiKey,
    billingAccountId: config.billingAccountId,
    priceId: config.priceId,
  };
  const explicitResult = await runConvexResult({
    deployment: config.sealDeployment,
    functionName,
    args: explicitConfigArgs,
  });

  if (explicitResult.exitCode === 0) {
    return parseConvexJson<JsonObject>(explicitResult.stdout, functionName);
  }

  const output = `${explicitResult.stderr}\n${explicitResult.stdout}`;
  if (!output.includes("Object contains extra field `apiBaseUrl`")) {
    fail(`convex run ${functionName} failed\n${explicitResult.stderr}\n${explicitResult.stdout}`);
  }

  const legacyResult = await runConvexResult({
    deployment: config.sealDeployment,
    functionName,
    args: baseArgs,
  });
  if (legacyResult.exitCode !== 0) {
    fail(
      `convex run ${functionName} failed after legacy fallback\n` +
        `${legacyResult.stderr}\n${legacyResult.stdout}`,
    );
  }
  return parseConvexJson<JsonObject>(legacyResult.stdout, functionName);
}

async function main(): Promise<void> {
  const config = await readProofConfig();
  const checkout = await createCheckoutProofSession(config);

  const checkoutUrl = stringField(checkout, "checkoutUrl");
  assert(checkoutUrl.startsWith("https://"), "Expected hosted checkout URL");
  assert(checkoutUrl.startsWith(config.vortexBaseUrl), "Expected checkout URL from Vortex");
  assert(
    numberField(checkout, "amountTotal") === expectedUnitAmount,
    "Expected checkout amountTotal to match Seal Professional monthly price",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_saas_checkout_vortex",
        boundary: "Seal SaaS subscription checkout only; document payments are out of scope",
        sealDeployment: config.sealDeployment,
        vortexDeployment: config.vortexDeployment,
        vortexBaseUrl: config.vortexBaseUrl,
        organizationId: config.organizationId,
        billingAccountId: config.billingAccountId,
        lookupKey,
        priceId: config.priceId,
        checkout: {
          checkoutUrl,
          amountTotal: numberField(checkout, "amountTotal"),
          amountRemaining: numberField(checkout, "amountRemaining"),
        },
      },
      null,
      2,
    ),
  );
}

await main();
