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
const defaultVortexBaseUrl = "https://notable-leopard-969.convex.site";
const defaultVortexDeployment = "dev:notable-leopard-969";
const paidEventType = "payable_object.updated";

type VortexApiConfig = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
};

type VortexContext = {
  readonly organizationId: string;
  readonly environment: "sandbox" | "production";
};

type VortexEvent = JsonObject & {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
};

type VortexDelivery = JsonObject & {
  readonly deliveryId: string;
  readonly endpointId: string;
  readonly status: string;
};

type VortexDispatchResult = JsonObject & {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
};

type VortexRedriveResult =
  | {
      readonly attempted: false;
      readonly reason: "disabled" | "missing_api_key" | "missing_event" | "already_succeeded";
      readonly eventId?: string;
      readonly deliveryId?: string;
    }
  | {
      readonly attempted: true;
      readonly eventId: string;
      readonly deliveryId: string;
      readonly dispatch: {
        readonly attempted: number;
        readonly succeeded: number;
        readonly failed: number;
      };
    };

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

function optionalObjectField(value: JsonObject, field: string): JsonObject | undefined {
  const child = value[field];
  assert(
    child === undefined || isJsonObject(child),
    `Expected ${field} to be an object when present`,
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

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
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

async function readVortexApiConfig(sealDeployment: string): Promise<VortexApiConfig | null> {
  const apiKey =
    readEnv("VORTEX_BILLING_API_KEY") ??
    (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_API_KEY" }));
  if (apiKey === undefined) {
    return null;
  }

  const apiBaseUrl =
    readEnv("VORTEX_BILLING_API_BASE_URL") ??
    (await getConvexEnv({ deployment: sealDeployment, name: "VORTEX_BILLING_API_BASE_URL" })) ??
    defaultVortexBaseUrl;
  return { apiBaseUrl, apiKey };
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
    cwd: new URL("../../vortex-payments/apps/backend", import.meta.url).pathname,
    deployment: input.deployment,
    label: `vortex convex run ${input.functionName}`,
  });
  if (result.exitCode !== 0) {
    fail(`vortex convex run ${input.functionName} failed\n${result.stderr}\n${result.stdout}`);
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

async function readVortexPayable(input: {
  readonly deployment: string;
  readonly vortexPayableId: string;
}): Promise<JsonObject | null> {
  const config = await readVortexApiConfig(input.deployment);
  if (config === null) {
    return null;
  }

  const response = await fetch(`${config.apiBaseUrl}/v1/payables/${input.vortexPayableId}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const body = parseJson(await response.text(), "Vortex payable response");
  assert(isJsonObject(body), "Expected Vortex payable response to be an object");
  if (!response.ok) {
    return {
      responseStatus: response.status,
      responseBody: body,
    };
  }
  const data = optionalObjectField(body, "data");
  const payable = data === undefined ? undefined : optionalObjectField(data, "payable");
  return payable ?? null;
}

async function resolveVortexContext(input: {
  readonly sealDeployment: string;
  readonly vortexDeployment: string;
}): Promise<VortexContext | null> {
  const config = await readVortexApiConfig(input.sealDeployment);
  if (config === null) {
    return null;
  }
  const context = await runVortexConvex<JsonObject>({
    deployment: input.vortexDeployment,
    functionName: "auth:resolveApiKey",
    args: { presentedKey: config.apiKey },
  });
  const organizationId = optionalStringField(context, "organizationId");
  const environment = optionalStringField(context, "environment");
  assert(
    environment === undefined || environment === "sandbox" || environment === "production",
    `Expected Vortex environment sandbox/production, got ${environment ?? "missing"}`,
  );
  if (organizationId === undefined || environment === undefined) {
    return null;
  }
  return { organizationId, environment };
}

function parseEventPayload(event: VortexEvent): JsonObject | null {
  const payload = optionalStringField(event, "payload");
  if (payload === undefined) {
    return null;
  }
  const parsed = parseJson(payload, `Vortex event ${event.eventId} payload`);
  return isJsonObject(parsed) ? parsed : null;
}

function eventMatchesPaidPayable(event: VortexEvent, vortexPayableId: string): boolean {
  if (event.eventType !== paidEventType || event.aggregateId !== vortexPayableId) {
    return false;
  }
  const payload = parseEventPayload(event);
  const payableObject = payload === null ? undefined : optionalObjectField(payload, "payableObject");
  if (payableObject === undefined) {
    return false;
  }
  return (
    optionalStringField(payableObject, "payableId") === vortexPayableId &&
    optionalStringField(payableObject, "status") === "paid"
  );
}

async function attemptVortexWebhookRedrive(input: {
  readonly sealDeployment: string;
  readonly vortexDeployment: string;
  readonly vortexPayableId: string;
  readonly disabled: boolean;
}): Promise<VortexRedriveResult> {
  if (input.disabled) {
    return { attempted: false, reason: "disabled" };
  }

  const context = await resolveVortexContext({
    sealDeployment: input.sealDeployment,
    vortexDeployment: input.vortexDeployment,
  });
  if (context === null) {
    return { attempted: false, reason: "missing_api_key" };
  }

  const events = await runVortexConvex<readonly VortexEvent[] & Json>({
    deployment: input.vortexDeployment,
    functionName: "outboundWebhooks:listEvents",
    args: {
      organizationId: context.organizationId,
      environment: context.environment,
      eventType: paidEventType,
      limit: 100,
    },
  });
  const event = events.find((candidate) => eventMatchesPaidPayable(candidate, input.vortexPayableId));
  if (event === undefined) {
    return { attempted: false, reason: "missing_event" };
  }

  const deliveries = await runVortexConvex<readonly VortexDelivery[] & Json>({
    deployment: input.vortexDeployment,
    functionName: "outboundWebhooks:listDeliveries",
    args: {
      organizationId: context.organizationId,
      environment: context.environment,
      eventId: event.eventId,
      limit: 100,
    },
  });
  const pending = deliveries.find((delivery) => delivery.status === "pending");
  const deliveryToDispatch = pending ?? deliveries.find((delivery) => delivery.status === "failed");
  if (deliveryToDispatch === undefined) {
    const succeeded = deliveries.find((delivery) => delivery.status === "succeeded");
    return {
      attempted: false,
      reason: "already_succeeded",
      eventId: event.eventId,
      deliveryId: succeeded?.deliveryId,
    };
  }

  const dispatchTarget = deliveryToDispatch.status === "failed"
    ? await runVortexConvex<JsonObject>({
      deployment: input.vortexDeployment,
      functionName: "outboundWebhooks:resendEvent",
      args: {
        organizationId: context.organizationId,
        environment: context.environment,
        eventId: event.eventId,
        endpointId: deliveryToDispatch.endpointId,
      },
    })
    : null;
  const resentDeliveries = dispatchTarget === null
    ? []
    : ((dispatchTarget.deliveries ?? []) as readonly VortexDelivery[]);
  const targetDelivery =
    deliveryToDispatch.status === "failed"
      ? resentDeliveries.find((delivery) => delivery.status === "pending")
      : deliveryToDispatch;
  assert(targetDelivery !== undefined, "Vortex webhook resend did not create a pending delivery");

  const dispatch = await runVortexConvex<VortexDispatchResult & JsonObject>({
    deployment: input.vortexDeployment,
    functionName: "outboundWebhooks:dispatchDeliveries",
    args: {
      organizationId: context.organizationId,
      environment: context.environment,
      deliveryId: targetDelivery.deliveryId,
    },
  });

  return {
    attempted: true,
    eventId: event.eventId,
    deliveryId: targetDelivery.deliveryId,
    dispatch: {
      attempted: dispatch.attempted,
      succeeded: dispatch.succeeded,
      failed: dispatch.failed,
    },
  };
}

function printFailureDiagnostic(input: {
  readonly sealDeployment: string;
  readonly vortexPayableId: string;
  readonly hostedInvoiceUrl: string;
  readonly sealState: JsonObject;
  readonly vortexPayable: JsonObject | null;
}): void {
  const vortexStatus =
    input.vortexPayable === null ? undefined : optionalStringField(input.vortexPayable, "status");
  const amountPaid =
    input.vortexPayable === null ? undefined : optionalNumberField(input.vortexPayable, "amountPaid");
  const amountRemaining =
    input.vortexPayable === null
      ? undefined
      : optionalNumberField(input.vortexPayable, "amountRemaining");

  console.error(
    JSON.stringify(
      {
        ok: false,
        check: "seal_document_payment_vortex_paid_state",
        sealDeployment: input.sealDeployment,
        vortexPayableId: input.vortexPayableId,
        hostedInvoiceUrl: input.hostedInvoiceUrl,
        diagnosis:
          vortexStatus !== undefined && vortexStatus !== "paid"
            ? "vortex_payable_not_paid"
            : vortexStatus === "paid"
              ? "vortex_paid_but_seal_not_projected"
              : "seal_not_paid_vortex_state_unavailable",
        vortex: {
          status: vortexStatus,
          amountPaid,
          amountRemaining,
        },
        seal: input.sealState,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const sealDeployment = readEnv("SEAL_CONVEX_DEPLOYMENT") ?? readEnv("CONVEX_DEPLOYMENT") ?? "dev";
  const vortexDeployment = readEnv("VORTEX_CONVEX_DEPLOYMENT") ?? defaultVortexDeployment;
  const redriveDisabled = hasFlag("no-redrive-vortex-webhook");
  const vortexPayableId =
    parseArgValue("vortex-payable-id") ??
    readEnv("VORTEX_PAYABLE_ID") ??
    defaultVortexPayableId;
  const hostedInvoiceUrl =
    parseArgValue("hosted-invoice-url") ??
    readEnv("HOSTED_INVOICE_URL") ??
      defaultHostedInvoiceUrl;
  const state = await readPaymentState({ deployment: sealDeployment, vortexPayableId });
  const vortexPayable = await readVortexPayable({ deployment: sealDeployment, vortexPayableId });

  const paymentStatus = optionalStringField(state, "paymentStatus");
  const invoiceStatus = optionalStringField(state, "invoiceStatus");
  const invoiceProvider = optionalStringField(state, "invoiceProvider");
  const documentWorkflowStatus = optionalStringField(state, "documentWorkflowStatus");
  const invoicePaidAt = optionalNumberField(state, "invoicePaidAt");
  const stateHostedInvoiceUrl =
    optionalStringField(state, "hostedInvoiceUrl") ?? optionalStringField(state, "invoiceHostedUrl");

  let finalState = state;
  let webhookRedrive: VortexRedriveResult | undefined;
  if (
    paymentStatus !== "paid" ||
    invoiceStatus !== "paid" ||
    invoiceProvider !== "vortex_billing" ||
    documentWorkflowStatus !== "completed" ||
    invoicePaidAt === undefined ||
    stateHostedInvoiceUrl !== hostedInvoiceUrl
  ) {
    const vortexStatus =
      vortexPayable === null ? undefined : optionalStringField(vortexPayable, "status");
    const amountRemaining =
      vortexPayable === null ? undefined : optionalNumberField(vortexPayable, "amountRemaining");
    if (vortexStatus !== undefined && vortexStatus !== "paid") {
      printFailureDiagnostic({
        sealDeployment,
        vortexPayableId,
        hostedInvoiceUrl,
        sealState: state,
        vortexPayable,
      });
      fail(
        `Vortex payable is ${vortexStatus} with amountRemaining ${amountRemaining ?? "unknown"}; pay the hosted checkout first.`,
      );
    }
    if (vortexStatus === "paid") {
      webhookRedrive = await attemptVortexWebhookRedrive({
        sealDeployment,
        vortexDeployment,
        vortexPayableId,
        disabled: redriveDisabled,
      });
      finalState = await readPaymentState({ deployment: sealDeployment, vortexPayableId });
      const finalPaymentStatus = optionalStringField(finalState, "paymentStatus");
      const finalInvoiceStatus = optionalStringField(finalState, "invoiceStatus");
      const finalDocumentWorkflowStatus = optionalStringField(finalState, "documentWorkflowStatus");
      const finalInvoicePaidAt = optionalNumberField(finalState, "invoicePaidAt");
      const finalHostedInvoiceUrl =
        optionalStringField(finalState, "hostedInvoiceUrl") ??
        optionalStringField(finalState, "invoiceHostedUrl");
      if (
        finalPaymentStatus !== "paid" ||
        finalInvoiceStatus !== "paid" ||
        finalDocumentWorkflowStatus !== "completed" ||
        finalInvoicePaidAt === undefined ||
        finalHostedInvoiceUrl !== hostedInvoiceUrl
      ) {
        printFailureDiagnostic({
          sealDeployment,
          vortexPayableId,
          hostedInvoiceUrl,
          sealState: finalState,
          vortexPayable,
        });
        fail(
          `Vortex payable is paid but Seal is ${finalPaymentStatus ?? "missing"}/${finalInvoiceStatus ?? "missing"} after webhook redrive ${JSON.stringify(webhookRedrive)}.`,
        );
      }
    }
  }

  const finalPaymentStatus = optionalStringField(finalState, "paymentStatus");
  const finalInvoiceStatus = optionalStringField(finalState, "invoiceStatus");
  const finalInvoiceProvider = optionalStringField(finalState, "invoiceProvider");
  const finalDocumentWorkflowStatus = optionalStringField(finalState, "documentWorkflowStatus");
  const finalInvoicePaidAt = optionalNumberField(finalState, "invoicePaidAt");
  const finalHostedInvoiceUrl =
    optionalStringField(finalState, "hostedInvoiceUrl") ??
    optionalStringField(finalState, "invoiceHostedUrl");

  assert(finalPaymentStatus === "paid", `Expected paymentStatus paid, got ${finalPaymentStatus ?? "missing"}`);
  assert(finalInvoiceStatus === "paid", `Expected invoiceStatus paid, got ${finalInvoiceStatus ?? "missing"}`);
  assert(
    finalInvoiceProvider === "vortex_billing",
    `Expected invoiceProvider vortex_billing, got ${finalInvoiceProvider ?? "missing"}`,
  );
  assert(
    finalDocumentWorkflowStatus === "completed",
    `Expected documentWorkflowStatus completed, got ${finalDocumentWorkflowStatus ?? "missing"}`,
  );
  assert(finalInvoicePaidAt !== undefined, "Expected invoicePaidAt after paid webhook projection");
  assert(
    finalHostedInvoiceUrl === hostedInvoiceUrl,
    `Expected hosted invoice URL ${hostedInvoiceUrl}, got ${finalHostedInvoiceUrl ?? "missing"}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "seal_document_payment_vortex_paid_state",
        boundary:
          "Verifies Seal state after a real Vortex-hosted document payment is paid; settlement and payout reconciliation remain follow-up proof.",
        sealDeployment,
        vortexDeployment,
        vortexPayableId,
        hostedInvoiceUrl,
        webhookRedrive,
        state: {
          paymentStatus: finalPaymentStatus,
          invoiceStatus: finalInvoiceStatus,
          invoiceProvider: finalInvoiceProvider,
          documentWorkflowStatus: finalDocumentWorkflowStatus,
          invoicePaidAt: finalInvoicePaidAt,
        },
      },
      null,
      2,
    ),
  );
}

await main();
