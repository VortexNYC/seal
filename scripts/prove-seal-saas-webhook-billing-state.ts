#!/usr/bin/env bun

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const proofIdentityIssuer = "seal-vortex-onboarding-proof";

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

function booleanField(value: JsonObject, field: string): boolean {
  const child = value[field];
  assert(typeof child === "boolean", `Expected ${field} to be a boolean`);
  return child;
}

function nullableStringField(value: JsonObject, field: string): string | null {
  const child = value[field];
  if (child === null || typeof child === "string") {
    return child;
  }
  return fail(`Expected ${field} to be a string or null`);
}

function nullableObjectField(
  value: JsonObject,
  field: string
): JsonObject | null {
  const child = value[field];
  if (child === null || isJsonObject(child)) {
    return child;
  }
  return fail(`Expected ${field} to be an object or null`);
}

function parseJson(raw: string, label: string): Json {
  const parsed = JSON.parse(raw) as unknown;
  assert(isJson(parsed), `Expected ${label} to be valid JSON`);
  return parsed;
}

/**
 * Convex function results are JSON; callers declare the expected shape via
 * the type parameter. That shape is trusted at this single documented seam
 * (or validated when a predicate is supplied).
 */
function isExpectedJsonShape<T extends Json>(
  value: Json,
  validate?: (candidate: Json) => candidate is T
): value is T {
  return validate ? validate(value) : true;
}

function isJson(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJson);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJson);
  }
  return false;
}

async function runCommand(input: {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly label: string;
  readonly deployment: string;
}): Promise<string> {
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
  if (exitCode !== 0) {
    fail(`${input.label} failed\n${stderr}\n${stdout}`);
  }
  return stdout;
}

async function runConvex<T extends Json>(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
  readonly identity?: JsonObject;
}): Promise<T> {
  const stdout = await runCommand({
    command: [
      "bunx",
      "convex",
      "run",
      "--push",
      "--typecheck=disable",
      "--codegen=disable",
      ...(input.identity === undefined
        ? []
        : ["--identity", JSON.stringify(input.identity)]),
      input.functionName,
      JSON.stringify(input.args),
    ],
    cwd: sealConvexCwd,
    label: `convex run ${input.functionName}`,
    deployment: input.deployment,
  });
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(
    jsonStart >= 0,
    `No JSON returned from ${input.functionName}: ${trimmed}`
  );
  const parsed = parseJson(trimmed.slice(jsonStart), input.functionName);
  if (isExpectedJsonShape<T>(parsed)) {
    return parsed;
  }
  return fail(`Unexpected JSON shape from ${input.functionName}`);
}

async function getConvexEnv(input: {
  readonly deployment: string;
  readonly name: string;
}): Promise<string | undefined> {
  const child = Bun.spawn(["bunx", "convex", "env", "get", input.name], {
    cwd: sealConvexCwd,
    env: { ...process.env, CONVEX_DEPLOYMENT: input.deployment },
    stdout: "pipe",
    stderr: "pipe",
  });
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

function parsePriceMap(raw: string | undefined): string {
  assert(
    raw !== undefined,
    "VORTEX_BILLING_SAAS_PRICE_MAP is missing; run prove:seal-coupons-vortex first"
  );
  const parsed = parseJson(raw, "VORTEX_BILLING_SAAS_PRICE_MAP");
  assert(
    isJsonObject(parsed),
    "Expected VORTEX_BILLING_SAAS_PRICE_MAP to be a JSON object"
  );
  const sealProMonthlyPriceId = parsed["pro:monthly:v2"];
  if (
    typeof sealProMonthlyPriceId === "string" &&
    sealProMonthlyPriceId.length > 0
  ) {
    return sealProMonthlyPriceId;
  }
  const firstPriceId = Object.values(parsed).find(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  assert(
    firstPriceId !== undefined,
    "Expected VORTEX_BILLING_SAAS_PRICE_MAP to contain at least one price id"
  );
  return firstPriceId;
}

function mergeAllowlist(
  current: string | undefined,
  organizationId: string
): string {
  if (
    current === undefined ||
    current.trim() === "" ||
    current.trim() === "[]"
  ) {
    return JSON.stringify([organizationId]);
  }
  const normalized = current.trim();
  if (normalized === "*") {
    return normalized;
  }
  if (normalized.startsWith("[")) {
    const parsed = JSON.parse(normalized) as unknown;
    assert(
      Array.isArray(parsed),
      "Expected VORTEX_BILLING_SAAS_ORGANIZATION_IDS to be a JSON array"
    );
    const entries = parsed.filter(
      (entry): entry is string => typeof entry === "string"
    );
    return JSON.stringify([...new Set([...entries, organizationId])]);
  }
  return JSON.stringify([
    ...new Set([
      ...normalized.split(",").map((entry) => entry.trim()),
      organizationId,
    ]),
  ]);
}

function identityForSubject(subject: string): JsonObject {
  return {
    subject,
    issuer: proofIdentityIssuer,
    name: "Seal Vortex Billing Projection Proof Owner",
    email: `seal-vortex-billing-projection+${proofRunId}@seal.test`,
  };
}

type ProofContext = {
  readonly sealDeployment: string;
  readonly organizationId: string;
  readonly ownerAuthSubject: string;
  readonly priceId: string;
};

type ProjectedSubscription = {
  readonly subscriptionExternalId: string;
  readonly customerExternalId: string;
  readonly priceId: string;
};

async function createProofContext(): Promise<ProofContext> {
  const sealDeployment =
    readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const proofOrg = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName:
      "vortex_billing/proof_actions:ensureSealVortexOnboardingProofOrganization",
    args: { proofRunId },
  });
  const organizationId = stringField(proofOrg, "organizationId");
  const ownerAuthSubject = stringField(proofOrg, "ownerAuthSubject");
  const priceId = parsePriceMap(
    await getConvexEnv({
      deployment: sealDeployment,
      name: "VORTEX_BILLING_SAAS_PRICE_MAP",
    })
  );

  return { sealDeployment, organizationId, ownerAuthSubject, priceId };
}

async function allowlistSaasOrganization(input: {
  readonly deployment: string;
  readonly organizationId: string;
}): Promise<void> {
  await setConvexEnv({
    deployment: input.deployment,
    name: "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
    value: mergeAllowlist(
      await getConvexEnv({
        deployment: input.deployment,
        name: "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
      }),
      input.organizationId
    ),
  });
}

async function projectVortexSubscription(input: {
  readonly deployment: string;
  readonly organizationId: string;
  readonly priceId: string;
}): Promise<ProjectedSubscription> {
  const currentPeriodStart = new Date().toISOString();
  const currentPeriodEnd = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const customerExternalId = `vtx_cust_seal_projection_${proofRunId}`;
  const subscriptionExternalId = `vtx_sub_seal_projection_${proofRunId}`;

  const projection = await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName: "vortex_billing/projection:projectSubscriptionUpdated",
    args: {
      eventId: `evt_vtx_seal_projection_${proofRunId}`,
      eventType: "subscription.updated",
      sealOrganizationId: input.organizationId,
      subscriptionExternalId,
      customerExternalId,
      planCode: input.priceId,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart,
      currentPeriodEnd,
      latestInvoiceId: `inv_vtx_seal_projection_${proofRunId}`,
      sourceCreatedAt: Date.now(),
    },
  });
  assert(
    booleanField(projection, "processed"),
    "Expected subscription projection to process"
  );
  assert(
    !booleanField(projection, "activeNonVortexProviderIdPresent"),
    "Expected no active non-Vortex-provider-shaped subscription after Vortex projection"
  );
  return { subscriptionExternalId, customerExternalId, priceId: input.priceId };
}

async function assertProjectedState(input: {
  readonly deployment: string;
  readonly organizationId: string;
  readonly projected: ProjectedSubscription;
}): Promise<void> {
  const state = await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName: "vortex_billing/proof_actions:getVortexSaasBillingProofState",
    args: { organizationId: input.organizationId },
  });
  assert(
    nullableStringField(state, "organizationBillingCustomerId") === null,
    "Expected no organization billing customer after projection"
  );
  const subscription = nullableObjectField(state, "subscription");
  assert(subscription !== null, "Expected projected Vortex subscription");
  assert(
    stringField(subscription, "externalCustomerId") ===
      input.projected.customerExternalId,
    "Expected Vortex customer external id"
  );
  assert(
    stringField(subscription, "externalSubscriptionId") ===
      input.projected.subscriptionExternalId,
    "Expected Vortex subscription external id"
  );
  assert(
    stringField(subscription, "externalPriceId") === input.projected.priceId,
    "Expected Vortex price external id"
  );
  assert(
    stringField(subscription, "status") === "active",
    "Expected active projected subscription"
  );
  assert(
    !booleanField(state, "activeNonVortexProviderIdPresent"),
    "Expected proof state to report no active non-Vortex-provider-shaped ids"
  );
}

async function getBillingDetails(input: {
  readonly deployment: string;
  readonly ownerAuthSubject: string;
}): Promise<JsonObject> {
  const billingDetails = await runConvex<JsonObject>({
    deployment: input.deployment,
    functionName: "payments/billing_queries:getSubscriptionDetails",
    args: {},
    identity: identityForSubject(input.ownerAuthSubject),
  });
  assert(
    stringField(billingDetails, "status") === "active",
    "Expected billing settings query to show active subscription"
  );
  assert(
    numberField(billingDetails, "unitAmount") > 0,
    "Expected billing settings query to resolve Vortex price"
  );
  assert(
    stringField(billingDetails, "currency") === "usd",
    "Expected billing settings query to resolve USD price"
  );
  return billingDetails;
}

function printProofResult(input: {
  readonly context: ProofContext;
  readonly projected: ProjectedSubscription;
  readonly billingDetails: JsonObject;
}): void {
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_saas_webhook_billing_state",
        sealDeployment: input.context.sealDeployment,
        proofRunId,
        organizationId: input.context.organizationId,
        projected: {
          processed: true,
          subscriptionExternalId: input.projected.subscriptionExternalId,
          customerExternalId: input.projected.customerExternalId,
          priceId: input.projected.priceId,
          activeNonVortexProviderIdPresent: false,
        },
        billingSettingsState: {
          status: stringField(input.billingDetails, "status"),
          tier: stringField(input.billingDetails, "tier"),
          planName: stringField(input.billingDetails, "planName"),
          unitAmount: numberField(input.billingDetails, "unitAmount"),
          currency: stringField(input.billingDetails, "currency"),
        },
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const context = await createProofContext();
  await allowlistSaasOrganization({
    deployment: context.sealDeployment,
    organizationId: context.organizationId,
  });
  const projected = await projectVortexSubscription({
    deployment: context.sealDeployment,
    organizationId: context.organizationId,
    priceId: context.priceId,
  });
  await assertProjectedState({
    deployment: context.sealDeployment,
    organizationId: context.organizationId,
    projected,
  });
  const billingDetails = await getBillingDetails({
    deployment: context.sealDeployment,
    ownerAuthSubject: context.ownerAuthSubject,
  });
  printProofResult({ context, projected, billingDetails });
}

await main();
