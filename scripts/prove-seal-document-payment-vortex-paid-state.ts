#!/usr/bin/env bun

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const defaultVortexPayableId = "payable_mraoq9vj_sv6qnc8z";
const defaultHostedInvoiceUrl =
  "https://notable-leopard-969.convex.site/pay/pay_nUIiDG0pBcFAnaKiuK50gF1y4m3YleHOydRv3y98MKQ";

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

function parseJson(raw: string, label: string): Json {
  const parsed = JSON.parse(raw) as unknown;
  assert(isJson(parsed), `Expected ${label} to be valid JSON`);
  return parsed;
}

function optionalStringField(value: JsonObject, field: string): string | undefined {
  const child = value[field];
  assert(
    child === undefined || typeof child === "string",
    `Expected ${field} to be a string when present`,
  );
  return child;
}

function optionalNumberField(value: JsonObject, field: string): number | undefined {
  const child = value[field];
  assert(
    child === undefined || (typeof child === "number" && Number.isFinite(child)),
    `Expected ${field} to be a finite number when present`,
  );
  return child;
}

function parseArgValue(name: string): string | undefined {
  const prefixed = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefixed));
  if (inline !== undefined) {
    return inline.slice(prefixed.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    const value = process.argv[index + 1];
    assert(value !== undefined && !value.startsWith("--"), `Missing value for --${name}`);
    return value;
  }

  return undefined;
}

async function runCommand(input: {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly deployment: string;
  readonly label: string;
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

async function runSealConvex<T extends Json>(input: {
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
    label: `seal convex run ${input.functionName}`,
  });
  if (result.exitCode !== 0) {
    fail(`seal convex run ${input.functionName} failed\n${result.stderr}\n${result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(jsonStart >= 0, `No JSON returned from ${input.functionName}: ${trimmed}`);
  return parseJson(trimmed.slice(jsonStart), input.functionName) as T;
}

async function readPaymentState(input: {
  readonly deployment: string;
  readonly vortexPayableId: string;
}): Promise<JsonObject> {
  const state = await runSealConvex<JsonObject>({
    deployment: input.deployment,
    functionName: "vortex_billing/proof_actions:getVortexWebhookProofPaymentState",
    args: { vortexPayableId: input.vortexPayableId },
  });
  assert(isJsonObject(state), "Expected payment state to be an object");
  return state;
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexPayableId =
    parseArgValue("vortex-payable-id") ??
    readEnv("VORTEX_PAYABLE_ID") ??
    defaultVortexPayableId;
  const hostedInvoiceUrl =
    parseArgValue("hosted-invoice-url") ??
    readEnv("HOSTED_INVOICE_URL") ??
    defaultHostedInvoiceUrl;
  const state = await readPaymentState({ deployment: sealDeployment, vortexPayableId });

  const paymentStatus = optionalStringField(state, "paymentStatus");
  const invoiceStatus = optionalStringField(state, "invoiceStatus");
  const invoiceProvider = optionalStringField(state, "invoiceProvider");
  const documentWorkflowStatus = optionalStringField(state, "documentWorkflowStatus");
  const invoicePaidAt = optionalNumberField(state, "invoicePaidAt");
  const stateHostedInvoiceUrl =
    optionalStringField(state, "hostedInvoiceUrl") ?? optionalStringField(state, "invoiceHostedUrl");

  assert(paymentStatus === "paid", `Expected paymentStatus paid, got ${paymentStatus ?? "missing"}`);
  assert(invoiceStatus === "paid", `Expected invoiceStatus paid, got ${invoiceStatus ?? "missing"}`);
  assert(
    invoiceProvider === "vortex_billing",
    `Expected invoiceProvider vortex_billing, got ${invoiceProvider ?? "missing"}`,
  );
  assert(
    documentWorkflowStatus === "completed",
    `Expected documentWorkflowStatus completed, got ${documentWorkflowStatus ?? "missing"}`,
  );
  assert(invoicePaidAt !== undefined, "Expected invoicePaidAt after paid webhook projection");
  assert(
    stateHostedInvoiceUrl === hostedInvoiceUrl,
    `Expected hosted invoice URL ${hostedInvoiceUrl}, got ${stateHostedInvoiceUrl ?? "missing"}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_document_payment_vortex_paid_state",
        boundary:
          "Verifies Seal state after a real Vortex-hosted document payment is paid; settlement and payout reconciliation remain follow-up proof.",
        sealDeployment,
        vortexPayableId,
        hostedInvoiceUrl,
        state: {
          paymentStatus,
          invoiceStatus,
          invoiceProvider,
          documentWorkflowStatus,
          invoicePaidAt,
        },
      },
      null,
      2,
    ),
  );
}

await main();
