#!/usr/bin/env bun

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const sealConvexCwd = new URL("../apps/backend", import.meta.url).pathname;
const vortexConvexCwd = new URL("../../vortex-payments/apps/backend", import.meta.url).pathname;
const proofRunId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const defaultVortexDeployment = "dev:notable-leopard-969";
const defaultVortexBaseUrl = "https://notable-leopard-969.convex.site";
const amountCents = 4200;

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

function parseJson(raw: string, label: string): Json {
  const parsed = JSON.parse(raw) as unknown;
  assert(isJson(parsed), `Expected ${label} to be valid JSON`);
  return parsed;
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

function arrayField(value: JsonObject, field: string): readonly Json[] {
  const child = value[field];
  assert(Array.isArray(child), `Expected ${field} to be an array`);
  return child;
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

async function getConvexEnv(input: {
  readonly deployment: string;
  readonly name: string;
}): Promise<string | undefined> {
  const result = await runCommand({
    command: ["bunx", "convex", "env", "get", input.name],
    cwd: sealConvexCwd,
    deployment: input.deployment,
    label: `convex env get ${input.name}`,
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
    label: `convex env set ${input.name}`,
  });
  if (result.exitCode !== 0) {
    fail(`convex env set ${input.name} failed\n${result.stderr}\n${result.stdout}`);
  }
}

async function runSealConvex<T extends Json>(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<T> {
  return await runConvex<T>({
    cwd: sealConvexCwd,
    deployment: input.deployment,
    functionName: input.functionName,
    args: input.args,
    label: `seal convex run ${input.functionName}`,
  });
}

async function runVortexConvex<T extends Json>(input: {
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
}): Promise<T> {
  return await runConvex<T>({
    cwd: vortexConvexCwd,
    deployment: input.deployment,
    functionName: input.functionName,
    args: input.args,
    label: `vortex convex run ${input.functionName}`,
  });
}

async function runConvex<T extends Json>(input: {
  readonly cwd: string;
  readonly deployment: string;
  readonly functionName: string;
  readonly args: JsonObject;
  readonly label: string;
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
    cwd: input.cwd,
    deployment: input.deployment,
    label: input.label,
  });
  if (result.exitCode !== 0) {
    fail(`${input.label} failed\n${result.stderr}\n${result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  const jsonStart = trimmed.search(/[[{"]/);
  assert(jsonStart >= 0, `No JSON returned from ${input.functionName}: ${trimmed}`);
  return parseJson(trimmed.slice(jsonStart), input.functionName) as T;
}

function readStringRecord(value: string | undefined, label: string): Record<string, string> {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }
  const parsed = parseJson(value, label);
  assert(isJsonObject(parsed), `Expected ${label} to be a JSON object`);
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    assert(typeof entry === "string", `Expected ${label}.${key} to be a string`);
    record[key] = entry;
  }
  return record;
}

function mergeAllowlist(current: string | undefined, organizationId: string): string {
  if (current === undefined || current.trim() === "" || current.trim() === "[]") {
    return JSON.stringify([organizationId]);
  }
  const normalized = current.trim();
  if (normalized === "*") {
    return normalized;
  }
  const entries = normalized.startsWith("[")
    ? parseJson(normalized, "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS")
    : normalized.split(",").map((entry) => entry.trim());
  assert(Array.isArray(entries), "Expected document payment allowlist to be an array");
  return JSON.stringify([
    ...new Set([
      ...entries.filter((entry): entry is string => typeof entry === "string"),
      organizationId,
    ]),
  ]);
}

async function mergeSealRecordEnv(input: {
  readonly deployment: string;
  readonly name: string;
  readonly updates: Readonly<Record<string, string>>;
}): Promise<void> {
  const existing = readStringRecord(
    await getConvexEnv({ deployment: input.deployment, name: input.name }),
    input.name,
  );
  await setConvexEnv({
    deployment: input.deployment,
    name: input.name,
    value: JSON.stringify({ ...existing, ...input.updates }),
  });
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexDeployment = readEnv("VORTEX_CONVEX_DEPLOYMENT") ?? defaultVortexDeployment;
  const vortexBaseUrl =
    readEnv("VORTEX_BILLING_API_BASE_URL") ??
    (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_API_BASE_URL" })) ??
    defaultVortexBaseUrl;
  const vortexApiKey =
    readEnv("VORTEX_BILLING_API_KEY") ??
    (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_API_KEY" }));
  assert(vortexApiKey !== undefined, "VORTEX_BILLING_API_KEY is missing");

  const vortexContext = await runVortexConvex<JsonObject>({
    deployment: vortexDeployment,
    functionName: "auth:resolveApiKey",
    args: { presentedKey: vortexApiKey },
  });
  const vortexOrganizationId = stringField(vortexContext, "organizationId");
  const environment = stringField(vortexContext, "environment");
  assert(
    environment === "sandbox" || environment === "production",
    `Unexpected environment ${environment}`,
  );

  const recipientEmail = `seal-document-payment-proof+${proofRunId}@seal.test`;
  const lineItemId = `seal_document_payment_line_${proofRunId}`;
  const productId = `vtx_prod_seal_document_payment_${proofRunId}`;
  const priceId = `vtx_price_seal_document_payment_${proofRunId}`;
  const customerId = `vtx_cust_seal_document_payment_${proofRunId}`;
  const billingAccountId = `bacc_seal_document_payment_${proofRunId}`;
  const merchantAccountId =
    readEnv("SEAL_VORTEX_DOCUMENT_PROOF_MERCHANT_ACCOUNT_ID") ?? `ma_seal_document_payment_proof`;

  await runVortexConvex<JsonObject>({
    deployment: vortexDeployment,
    functionName: "billingEngine:createProduct",
    args: {
      organizationId: vortexOrganizationId,
      environment,
      productId,
      name: "Seal document payment proof",
      metadata: { proof: "seal-document-payment-vortex-live", proofRunId },
    },
  });
  await runVortexConvex<JsonObject>({
    deployment: vortexDeployment,
    functionName: "billingEngine:createPrice",
    args: {
      organizationId: vortexOrganizationId,
      environment,
      priceId,
      productId,
      name: "Seal document payment proof one-time",
      priceType: "fixed_one_time",
      currency: "USD",
      unitAmount: amountCents,
      metadata: { proof: "seal-document-payment-vortex-live", proofRunId },
    },
  });
  await runVortexConvex<JsonObject>({
    deployment: vortexDeployment,
    functionName: "billingEngine:createCustomer",
    args: {
      organizationId: vortexOrganizationId,
      environment,
      customerId,
      name: "Seal document payment proof recipient",
      email: recipientEmail,
      defaultCurrency: "USD",
      metadata: { proof: "seal-document-payment-vortex-live", proofRunId },
    },
  });
  await runVortexConvex<JsonObject>({
    deployment: vortexDeployment,
    functionName: "billingEngine:createBillingAccount",
    args: {
      organizationId: vortexOrganizationId,
      environment,
      billingAccountId,
      customerId,
      merchantAccountId,
      invoiceDeliveryMode: "api_only",
      collectionMode: "manual",
      autoCollectionEnabled: false,
      metadata: { proof: "seal-document-payment-vortex-live", proofRunId },
    },
  });

  const seeded = await runSealConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:seedVortexOneTimeDocumentPayableProofDocument",
    args: { proofRunId, lineItemId, recipientEmail },
  });
  const organizationId = stringField(seeded, "organizationId");
  const ownerId = stringField(seeded, "ownerId");
  const documentId = stringField(seeded, "documentId");

  await setConvexEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS",
    value: mergeAllowlist(
      await getConvexEnv({
        deployment: sealDeployment,
        name: "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS",
      }),
      organizationId,
    ),
  });
  await mergeSealRecordEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_CUSTOMER_MAP",
    updates: { [recipientEmail]: customerId },
  });
  await mergeSealRecordEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_ACCOUNT_MAP",
    updates: { [organizationId]: billingAccountId },
  });
  await mergeSealRecordEnv({
    deployment: sealDeployment,
    name: "VORTEX_BILLING_PRICE_MAP",
    updates: { [lineItemId]: priceId },
  });

  const payable = await runSealConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:createVortexDocumentPayableProofObjects",
    args: { documentId, organizationId, userId: ownerId },
  });
  const paymentLinks = arrayField(payable, "paymentLinks");
  assert(paymentLinks.length === 1, "Expected exactly one Vortex payment link");
  const paymentLink = paymentLinks[0];
  assert(isJsonObject(paymentLink), "Expected paymentLinks[0] to be an object");
  const hostedInvoiceUrl = stringField(paymentLink, "hostedInvoiceUrl");
  assert(hostedInvoiceUrl.startsWith(vortexBaseUrl), "Expected hosted invoice URL from Vortex");
  assert(!/stripe\.com/i.test(hostedInvoiceUrl), "Expected Vortex hosted invoice URL, not Stripe");
  assert(numberField(paymentLink, "totalAmountCents") === amountCents, "Unexpected payment amount");
  const vortexPayableId = stringField(paymentLink, "providerInvoiceId");

  const state = await runSealConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexWebhookProofPaymentState",
    args: { vortexPayableId },
  });
  assert(stringField(state, "paymentStatus") === "awaiting", "Expected awaiting payment status");
  assert(
    stringField(state, "invoiceProvider") === "vortex_billing",
    "Expected Vortex invoice provider",
  );
  const waitingState = await runSealConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:markVortexDocumentPayableProofWaitingForPayment",
    args: { documentId },
  });
  assert(
    stringField(waitingState, "workflowStatus") === "waiting_for_payment",
    "Expected proof document to wait for payment",
  );
  const postSignatureState = await runSealConvex<JsonObject>({
    deployment: sealDeployment,
    functionName: "vortex_billing/proof_actions:getVortexWebhookProofPaymentState",
    args: { vortexPayableId },
  });
  assert(
    stringField(postSignatureState, "documentWorkflowStatus") === "waiting_for_payment",
    "Expected post-signature proof document to wait for payment",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_document_payment_vortex_live",
        boundary:
          "Creates a live Vortex-hosted document payment link. Actual card payment, platform-fee settlement, and payout reconciliation remain follow-up proof.",
        sealDeployment,
        vortexDeployment,
        vortexBaseUrl,
        proofRunId,
        organizationId,
        documentId,
        lineItemId,
        priceId,
        billingAccountId,
        customerId,
        merchantAccountId,
        payment: {
          vortexPayableId,
          hostedInvoiceUrl,
          totalAmountCents: numberField(paymentLink, "totalAmountCents"),
          currency: stringField(paymentLink, "currency"),
        },
        state: {
          paymentStatus: stringField(postSignatureState, "paymentStatus"),
          invoiceStatus: stringField(postSignatureState, "invoiceStatus"),
          invoiceProvider: stringField(postSignatureState, "invoiceProvider"),
          documentWorkflowStatus: stringField(postSignatureState, "documentWorkflowStatus"),
        },
      },
      null,
      2,
    ),
  );
}

await main();
