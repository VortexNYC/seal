#!/usr/bin/env bun

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
  assert(typeof child === "string" && child.length > 0, `Expected ${field} to be a string`);
  return child;
}

function nullableStringField(value: JsonObject, field: string): string | null {
  const child = value[field];
  assert(child === null || typeof child === "string", `Expected ${field} to be a string or null`);
  return child;
}

function nullableObjectField(value: JsonObject, field: string): JsonObject | null {
  const child = value[field];
  assert(child === null || isJsonObject(child), `Expected ${field} to be an object or null`);
  return child;
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

async function runConvexVoid(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<void> {
  await runCommand({
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
  const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
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

function mergeAllowlist(current: string | undefined, organizationId: string): string {
  if (current === undefined || current.trim() === "" || current.trim() === "[]") {
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
      "Expected VORTEX_BILLING_SAAS_ORGANIZATION_IDS to be a JSON array",
    );
    const entries = parsed.filter((entry): entry is string => typeof entry === "string");
    return JSON.stringify([...new Set([...entries, organizationId])]);
  }
  return JSON.stringify([
    ...new Set([...normalized.split(",").map((entry) => entry.trim()), organizationId]),
  ]);
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const proofOrg = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:ensureSealVortexOnboardingProofOrganization",
    args: { proofRunId },
  });
  const organizationId = stringField(proofOrg, "organizationId");
  const currentAllowlist = await getConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
  });
  await setConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
    value: mergeAllowlist(currentAllowlist, organizationId),
  });

  const beforeState = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexSaasBillingProofState",
    args: { organizationId },
  });
  assert(
    nullableStringField(beforeState, "organizationStripeCustomerId") === null,
    "Expected proof org to start without a Stripe customer id",
  );
  assert(
    nullableObjectField(beforeState, "subscription") === null,
    "Expected proof org to start without a subscription",
  );

  const newOrgResult = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "stripe/subscription_actions:handleNewOrgCreated",
    args: {
      organizationId,
      orgName: `Seal Vortex Lifecycle Guard ${proofRunId}`,
      adminEmail: `seal-vortex-lifecycle+${proofRunId}@seal.test`,
    },
  });
  assert(
    stringField(newOrgResult, "skippedReason") === "vortex_billing",
    "Expected Stripe new-org provisioning to skip Vortex Billing org",
  );

  await runConvexVoid({
    deployment: sealDeployment,
    functionName: "stripe/subscription_actions:syncSeatCount",
    args: { organizationId },
  });

  const afterState = await runConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexSaasBillingProofState",
    args: { organizationId },
  });
  assert(
    nullableStringField(afterState, "organizationStripeCustomerId") === null,
    "Expected Vortex Billing org to remain without a Stripe customer id",
  );
  assert(
    nullableObjectField(afterState, "subscription") === null,
    "Expected Vortex Billing org to create no Stripe subscription",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_saas_stripe_lifecycle_guard",
        sealDeployment,
        proofRunId,
        organizationId,
        handleNewOrgCreated: {
          skippedReason: stringField(newOrgResult, "skippedReason"),
        },
        syncSeatCount: {
          skipped: true,
        },
        stripeState: {
          organizationStripeCustomerId: null,
          subscription: null,
        },
      },
      null,
      2,
    ),
  );
}

await main();
