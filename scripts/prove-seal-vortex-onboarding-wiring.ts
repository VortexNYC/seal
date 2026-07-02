#!/usr/bin/env bun

import { existsSync } from "node:fs";

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

const repoRoot = new URL("..", import.meta.url).pathname;
// Seal is a monorepo — the Convex app (and its `convex` dependency) lives in apps/backend,
// so all Seal `convex run/env` commands must run from there, not the repo root.
const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const defaultVortexRepoRoot = "/Users/shlomokabareti/Projects/vortex-payments";
const proofIdentityIssuer = "seal-vortex-onboarding-proof";
const environment = readEnv("VORTEX_BILLING_PAYMENTS_ENVIRONMENT") ?? "sandbox";
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function warnAndSkip(missing: readonly string[]): never {
  console.warn("Skipping Seal Vortex onboarding wiring live proof.");
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

function booleanField(value: JsonObject, field: string): boolean {
  const child = value[field];
  assert(typeof child === "boolean", `Expected ${field} to be a boolean`);
  return child;
}

function responseData(body: JsonObject, label: string): JsonObject {
  return objectField(body, "data") ?? fail(`Expected ${label} to include data`);
}

function urlWithoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function runCommand(input: {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly label: string;
}): Promise<string> {
  const child = Bun.spawn(input.command, {
    cwd: input.cwd,
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
  readonly cwd: string;
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
  readonly identity?: JsonObject;
}): Promise<T> {
  const command = [
    "bunx",
    "convex",
    "run",
    `--deployment=${input.deployment}`,
    "--typecheck=disable",
    "--codegen=disable",
    ...(input.identity === undefined ? [] : ["--identity", JSON.stringify(input.identity)]),
    input.functionName,
    JSON.stringify(input.args),
  ];
  const stdout = await runCommand({
    command,
    cwd: input.cwd,
    label: `convex run ${input.functionName}`,
  });
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(jsonStart >= 0, `No JSON returned from ${input.functionName}: ${trimmed}`);
  return JSON.parse(trimmed.slice(jsonStart)) as T;
}

async function getConvexEnv(input: {
  readonly cwd: string;
  readonly deployment: string;
  readonly name: string;
}): Promise<string | undefined> {
  const child = Bun.spawn(
    ["bunx", "convex", "env", "get", `--deployment=${input.deployment}`, input.name],
    {
      cwd: input.cwd,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    return undefined;
  }
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function setConvexEnv(input: {
  readonly cwd: string;
  readonly deployment: string;
  readonly name: string;
  readonly value: string;
}): Promise<void> {
  await runCommand({
    command: [
      "bunx",
      "convex",
      "env",
      "set",
      `--deployment=${input.deployment}`,
      input.name,
      input.value,
    ],
    cwd: input.cwd,
    label: `convex env set ${input.name}`,
  });
}

function identityForSubject(subject: string): JsonObject {
  return {
    subject,
    issuer: proofIdentityIssuer,
    name: "Seal Vortex Onboarding Proof Owner",
    email: `vortex-onboarding-owner+${proofRunId}@seal.test`,
  };
}

async function requestVortexJson(input: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly body?: JsonObject;
}): Promise<JsonObject> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${input.apiKey}`);
  if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method,
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const text = await response.text();
  const parsed = objectFromJson(
    text.length > 0 ? (JSON.parse(text) as Json) : null,
    `${input.method} ${input.path} response`,
  );
  if (response.status < 200 || response.status >= 300) {
    fail(`${input.method} ${input.path} failed: ${response.status}\n${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

async function requestHostedForm(input: {
  readonly pathOrUrl: string;
  readonly form: URLSearchParams;
  readonly label: string;
}): Promise<string> {
  const response = await fetch(input.pathOrUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: input.form,
  });
  const text = await response.text();
  if (response.status < 200 || response.status >= 300) {
    fail(`${input.label} failed: ${response.status}\n${text}`);
  }
  assert(response.headers.get("content-type")?.includes("text/html") === true, `${input.label} must return HTML`);
  return text;
}

function hostedKycForm(displayName: string): URLSearchParams {
  return new URLSearchParams({
    annualAchVolume: "200000",
    averageAchTransferAmount: "200000",
    achMaxTransactionAmount: "1000000",
    annualCardVolume: "12000000",
    averageCardTransferAmount: "5000",
    businessDescription: "Seal hosted KYC wiring proof merchant",
    refundPolicy: "exchange_only",
    cardPresentPercentage: "30",
    mailOrderTelephoneOrderPercentage: "10",
    ecommercePercentage: "60",
    businessToBusinessVolumePercentage: "100",
    businessToConsumerVolumePercentage: "0",
    consumerToConsumerVolumePercentage: "0",
    personToPersonVolumePercentage: "0",
    otherVolumePercentage: "0",
    owner0FirstName: "Jane",
    owner0LastName: "Doe",
    owner0Email: `seal-vortex-owner+${proofRunId}@example.com`,
    owner0Phone: "1234567890",
    owner0Title: "CEO",
    owner0TaxId: "123456789",
    owner0Ownership: "100",
    owner0BirthMonth: "1",
    owner0BirthDay: "1",
    owner0BirthYear: "1980",
    owner0AddressLine1: "631 Howard St",
    owner0AddressLine2: "",
    owner0City: "San Francisco",
    owner0Region: "CA",
    owner0PostalCode: "94105",
    owner0Country: "USA",
    settlementAccountName: displayName,
    settlementBankCode: "122105278",
    settlementAccountNumber: "0000000019",
    settlementAccountType: "business_checking",
  });
}

async function hashHostedToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function hostedTokenFromUrl(url: string): string {
  const path = new URL(url).pathname;
  const token = path.split("/").filter(Boolean).at(-1);
  assert(token !== undefined && token.startsWith("monb_"), `Expected hosted URL token: ${url}`);
  return token;
}

function assertNoOpenRequirements(input: {
  readonly snapshot: JsonObject;
  readonly requirements?: readonly Json[];
  readonly context: string;
}): void {
  const openRequirementIds = arrayField(input.snapshot, "openRequirementIds");
  const openRequirements = (input.requirements ?? [])
    .filter(isJsonObject)
    .filter((requirement) => {
      const status = requirement.status;
      return status === "pending" || status === "submitted" || status === "failed";
    });
  if (openRequirementIds.length > 0 || openRequirements.length > 0) {
    fail(`${input.context} returned open requirements:\n${JSON.stringify({
      openRequirementIds,
      requirements: openRequirements,
    }, null, 2)}`);
  }
}

async function refreshUntilApproved(input: {
  readonly vortexBaseUrl: string;
  readonly vortexApiKey: string;
  readonly merchantAccountId: string;
  readonly onboardingSessionId: string;
}): Promise<JsonObject> {
  const timeoutMs = Number(readEnv("FINIX_SMOKE_MERCHANT_READY_TIMEOUT_MS") ?? "600000");
  const pollMs = Number(readEnv("FINIX_SMOKE_MERCHANT_READY_POLL_MS") ?? "3000");
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0, "FINIX_SMOKE_MERCHANT_READY_TIMEOUT_MS must be positive");
  assert(Number.isInteger(pollMs) && pollMs > 0, "FINIX_SMOKE_MERCHANT_READY_POLL_MS must be positive");

  const deadline = Date.now() + timeoutMs;
  let latest: JsonObject | null = null;
  while (Date.now() <= deadline) {
    const refreshBody = await requestVortexJson({
      baseUrl: input.vortexBaseUrl,
      apiKey: input.vortexApiKey,
      method: "POST",
      path: `/v1/merchant-accounts/${encodeURIComponent(input.merchantAccountId)}/onboarding/${encodeURIComponent(input.onboardingSessionId)}/refresh`,
      body: { environment },
    });
    latest = responseData(refreshBody, "merchant onboarding provider refresh");
    const snapshot = objectField(latest, "snapshot");
    const requirements = arrayField(latest, "requirements");
    const status = stringField(snapshot, "status");
    if (status === "approved") {
      assertNoOpenRequirements({ snapshot, requirements, context: "approved onboarding refresh" });
      return latest;
    }
    if (status === "rejected" || status === "action_required") {
      fail(`Vortex onboarding reached blocking state "${status}":\n${JSON.stringify(latest, null, 2)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  fail(`Timed out after ${timeoutMs}ms waiting for onboarding approval:\n${JSON.stringify(latest, null, 2)}`);
}

function mergeAllowlist(current: string | undefined, organizationId: string): string {
  if (current === undefined || current.trim() === "" || current.trim() === "[]") {
    return JSON.stringify([organizationId]);
  }
  const normalized = current.trim();
  if (normalized === "*") {
    return normalized;
  }
  if (normalized.startsWith("[")) {
    const parsed = JSON.parse(normalized) as Json;
    assert(Array.isArray(parsed), "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS must be an array");
    const values = parsed.filter((entry): entry is string => typeof entry === "string");
    return JSON.stringify([...new Set([...values, organizationId])]);
  }
  const values = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return [...new Set([...values, organizationId])].join(",");
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexDeployment = readEnv("VORTEX_CONVEX_DEPLOYMENT") ?? "dev";
  const vortexBaseUrl = urlWithoutTrailingSlash(
    readEnv("VORTEX_BILLING_API_BASE_URL") ?? "https://notable-leopard-969.convex.site",
  );
  const vortexApiKey = readEnv("VORTEX_BILLING_API_KEY");
  const vortexRepoRoot = readEnv("VORTEX_PAYMENTS_REPO_ROOT") ?? defaultVortexRepoRoot;
  const finixUsername = readEnv("FINIX_SANDBOX_USERNAME");
  const finixPassword = readEnv("FINIX_SANDBOX_PASSWORD");
  const missing = [
    ...(vortexApiKey === undefined ? ["VORTEX_BILLING_API_KEY"] : []),
    ...(finixUsername === undefined ? ["FINIX_SANDBOX_USERNAME"] : []),
    ...(finixPassword === undefined ? ["FINIX_SANDBOX_PASSWORD"] : []),
    ...(!existsSync(vortexRepoRoot) ? [`VORTEX_PAYMENTS_REPO_ROOT (${vortexRepoRoot})`] : []),
  ];
  if (missing.length > 0) {
    warnAndSkip(missing);
  }

  assert(vortexApiKey !== undefined, "Vortex API key is required");
  assert(finixUsername !== undefined, "Finix username is required");
  assert(finixPassword !== undefined, "Finix password is required");

  // NOTE: the Vortex dev deployment is provisioned by the Vortex repo (FINIX creds +
  // VORTEX_PAYMENTS_PROVIDER=finix), NOT from here. A Seal-side proof must not (and cannot,
  // cross-project) mutate Vortex's deployment env. We treat Vortex as an external service and
  // only drive its PUBLIC API. finixUsername/finixPassword above are asserted present so the
  // operator has confirmed the Vortex deployment is Finix-backed before running this proof.
  void finixUsername;
  void finixPassword;
  void vortexRepoRoot;

  const proofOrg = await runConvex<JsonObject>({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:ensureSealVortexOnboardingProofOrganization",
    args: { proofRunId },
  });
  const organizationId = stringField(proofOrg, "organizationId");
  const ownerAuthSubject = stringField(proofOrg, "ownerAuthSubject");
  const identity = identityForSubject(ownerAuthSubject);

  const currentAllowlist = await getConvexEnv({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    name: "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS",
  });
  await setConvexEnv({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    name: "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS",
    value: mergeAllowlist(currentAllowlist, organizationId),
  });
  await setConvexEnv({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    name: "VORTEX_BILLING_API_BASE_URL",
    value: vortexBaseUrl,
  });
  await setConvexEnv({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    name: "VORTEX_BILLING_API_KEY",
    value: vortexApiKey,
  });
  await setConvexEnv({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    name: "VORTEX_BILLING_PAYMENTS_ENVIRONMENT",
    value: environment,
  });

  const createResult = await runConvex<JsonObject>({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    functionName: "payments/merchant_account_actions:createMerchantAccount",
    args: { organizationId },
    identity,
  });
  const merchantAccountId = stringField(createResult, "processorAccountId");

  const returnUrl = readEnv("SEAL_PROOF_RETURN_URL") ?? "https://seal.test/settings/payments";
  const linkResult = await runConvex<JsonObject>({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    functionName: "payments/merchant_account_actions:createMerchantOnboardingLink",
    args: {
      organizationId,
      returnUrl,
      refreshUrl: returnUrl,
    },
    identity,
  });
  const hostedUrl = stringField(linkResult, "url");
  const preSubmitOnboardingSessionId = optionalStringField(linkResult, "onboardingSessionId");
  assert(
    hostedUrl.includes("/merchant-onboarding/monb_"),
    `Expected Vortex hosted onboarding URL, got ${hostedUrl}`,
  );
  assert(
    preSubmitOnboardingSessionId !== undefined,
    "Expected Vortex onboardingSessionId from Seal createMerchantOnboardingLink",
  );
  optionalStringField(linkResult, "expiresAt");

  const displayName = `Seal Vortex Onboarding ${proofRunId}`.slice(0, 60);
  const hostedKycHtml = await requestHostedForm({
    pathOrUrl: `${hostedUrl}/kyc/submit`,
    form: hostedKycForm(displayName),
    label: "hosted KYC form submit",
  });
  assert(
    hostedKycHtml.includes("Business review information saved."),
    "Expected hosted KYC submit to save review information",
  );

  const finalHtml = await requestHostedForm({
    pathOrUrl: `${hostedUrl}/submit`,
    form: new URLSearchParams({ merchantAgreementAccepted: "true" }),
    label: "hosted final onboarding submit",
  });
  assert(finalHtml.includes("Onboarding submitted."), "Expected hosted final submit");

  const hostedToken = hostedTokenFromUrl(hostedUrl);
  const tokenHash = await hashHostedToken(hostedToken);
  const reconciledView = await runConvex<JsonObject | null>({
    cwd: vortexRepoRoot,
    deployment: vortexDeployment,
    functionName: "hostedMerchantOnboarding:getMerchantOnboardingHostedView",
    args: {
      tokenHash,
      now: new Date().toISOString(),
    },
  });
  assert(reconciledView !== null, "Expected Vortex hosted view after final submit");
  const reconciledLink = objectField(reconciledView, "link");
  const actualOnboardingSessionId = stringField(reconciledLink, "onboardingSessionId");
  assert(
    actualOnboardingSessionId !== preSubmitOnboardingSessionId,
    "Expected hosted link to reconcile to the real submitted onboarding session id",
  );

  const refreshed = await refreshUntilApproved({
    vortexBaseUrl,
    vortexApiKey,
    merchantAccountId,
    onboardingSessionId: actualOnboardingSessionId,
  });
  const refreshedSnapshot = objectField(refreshed, "snapshot");
  assert(stringField(refreshedSnapshot, "status") === "approved", "Expected approved onboarding");

  await runConvex<JsonObject>({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    functionName: "payments/merchant_account_actions:refreshMerchantAccount",
    args: { organizationId },
    identity,
  });

  const sealMerchantState = await runConvex<JsonObject>({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexMerchantProofState",
    args: { organizationId },
  });
  assert(stringField(sealMerchantState, "provider") === "vortex", "Expected Seal provider vortex");
  assert(
    stringField(sealMerchantState, "vortexMerchantAccountId") === merchantAccountId,
    "Expected Seal to store the Vortex merchant account id",
  );
  assert(booleanField(sealMerchantState, "chargesEnabled") === true, "Expected Seal chargesEnabled true");

  const resolvedMerchantAccountId = await runConvex<string | null>({
    cwd: sealConvexCwd,
    deployment: sealDeployment,
    functionName: "payments/vortex_merchant_queries:getVortexMerchantAccountIdForOrg",
    args: { organizationId },
  });
  assert(
    resolvedMerchantAccountId === merchantAccountId,
    "Expected routing resolver to return charges-ready Vortex merchant account id",
  );

  const payoutProfileBody = await requestVortexJson({
    baseUrl: vortexBaseUrl,
    apiKey: vortexApiKey,
    method: "GET",
    path: `/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/payout-profile?environment=${environment}`,
  });
  const payoutProfile = nullableObjectField(payoutProfileBody, "data");
  assert(payoutProfile !== null, "Expected Vortex payout profile");

  console.log(JSON.stringify({
    ok: true,
    check: "seal_vortex_onboarding_wiring",
    sealDeployment,
    vortexDeployment,
    vortexBaseUrl,
    environment,
    organizationId,
    merchantAccountId,
    preSubmitOnboardingSessionId,
    onboardingSessionId: actualOnboardingSessionId,
    chargesEnabled: booleanField(sealMerchantState, "chargesEnabled"),
    resolvedMerchantAccountId,
    payoutProfile: {
      mode: stringField(payoutProfile, "mode"),
      payoutRail: stringField(payoutProfile, "payoutRail"),
      payoutSchedule: stringField(payoutProfile, "payoutSchedule"),
    },
  }, null, 2));
}

await main();
