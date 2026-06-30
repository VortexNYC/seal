"use node";

import { createClient, createCheckoutSession } from "@vortexnyc/payments-sdk";
import { ConvexError } from "convex/values";

type Env = {
  readonly [key: string]: string | undefined;
};

export type SaasBillingProvider = "stripe" | "vortex_billing";

export type VortexBillingCheckoutArgs = {
  readonly organizationId: string;
  readonly lookupKey: string;
  readonly quantity: number;
};

type VortexBillingConfig = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly billingAccountId: string;
  readonly priceId: string;
  readonly customerExternalId: string;
  readonly subscriptionExternalId: string;
};

const SAAS_ALLOWLIST_ENV = "VORTEX_BILLING_SAAS_ORGANIZATION_IDS";
const API_BASE_URL_ENV = "VORTEX_BILLING_API_BASE_URL";
const API_KEY_ENV = "VORTEX_BILLING_API_KEY";
const ACCOUNT_ID_ENV = "VORTEX_BILLING_ACCOUNT_ID";
const ACCOUNT_MAP_ENV = "VORTEX_BILLING_ACCOUNT_MAP";
const CUSTOMER_MAP_ENV = "VORTEX_BILLING_CUSTOMER_MAP";
const PRICE_MAP_ENV = "VORTEX_BILLING_SAAS_PRICE_MAP";

export function selectSaasBillingProvider(
  organizationId: string,
  env: Env = process.env,
): SaasBillingProvider {
  return isOrganizationAllowlisted(organizationId, env[SAAS_ALLOWLIST_ENV])
    ? "vortex_billing"
    : "stripe";
}

export async function createVortexBillingCheckoutSession(
  args: VortexBillingCheckoutArgs,
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const config = resolveVortexBillingConfig(args, env);
  const billingClient = createClient({
    baseUrl: trimTrailingSlash(config.apiBaseUrl),
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "x-vortex-service": "billing",
    },
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  const idempotencyKey = `seal-saas-checkout:${args.organizationId}:${normalizeExternalIdPart(args.lookupKey)}`;

  const { data, error, response } = await createCheckoutSession({
    client: billingClient,
    parseAs: "json",
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      mode: "subscription",
      customerExternalId: config.customerExternalId,
      billingAccountId: config.billingAccountId,
      subscriptionExternalId: config.subscriptionExternalId,
      collectionMode: "automatic",
      lineItems: [{ priceId: config.priceId, quantity: args.quantity }],
      createdByRef: "seal-saas-billing-settings",
      metadata: {
        sourceSystem: "seal",
        sealOrganizationId: args.organizationId,
        lookupKey: args.lookupKey,
      },
    },
  });

  if (error !== undefined || response === undefined || !response.ok) {
    const status = response?.status ?? "no-response";
    throw new ConvexError(
      `Vortex Billing checkout failed (${status}): ${summarizeJson(error ?? data)}`,
    );
  }

  return readCheckoutUrl(data);
}

export function resolveVortexBillingConfig(
  args: VortexBillingCheckoutArgs,
  env: Env = process.env,
): VortexBillingConfig {
  const apiBaseUrl = readRequiredEnv(env, API_BASE_URL_ENV);
  const apiKey = readRequiredEnv(env, API_KEY_ENV);
  const priceMap = parseStringRecord(readRequiredEnv(env, PRICE_MAP_ENV), PRICE_MAP_ENV);
  const accountMap = parseOptionalStringRecord(env[ACCOUNT_MAP_ENV], ACCOUNT_MAP_ENV);
  const customerMap = parseOptionalStringRecord(env[CUSTOMER_MAP_ENV], CUSTOMER_MAP_ENV);

  const priceId = priceMap[args.lookupKey];
  if (!priceId) {
    throw new ConvexError(`Vortex Billing price missing for lookup key: ${args.lookupKey}`);
  }

  const organizationKey = String(args.organizationId);
  const billingAccountId = accountMap[organizationKey] ?? env[ACCOUNT_ID_ENV];
  if (!billingAccountId) {
    throw new ConvexError(`Vortex Billing account missing for organization: ${organizationKey}`);
  }

  const customerExternalId = customerMap[organizationKey] ?? `vtx_cust_seal_org_${organizationKey}`;
  const subscriptionExternalId = `vtx_sub_seal_org_${organizationKey}_${normalizeExternalIdPart(
    args.lookupKey,
  )}`;

  return {
    apiBaseUrl,
    apiKey,
    billingAccountId,
    priceId,
    customerExternalId,
    subscriptionExternalId,
  };
}

function isOrganizationAllowlisted(
  organizationId: string,
  configured: string | undefined,
): boolean {
  if (configured === undefined || configured.trim() === "" || configured.trim() === "[]") {
    return false;
  }

  const normalized = configured.trim();
  if (normalized === "*") {
    return true;
  }

  if (normalized.startsWith("[")) {
    const parsed = parseJson(normalized, SAAS_ALLOWLIST_ENV);
    if (!Array.isArray(parsed)) {
      throw new ConvexError(`${SAAS_ALLOWLIST_ENV} must be a JSON string array, "*", or "[]"`);
    }

    return parsed.some((entry) => entry === organizationId);
  }

  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .includes(organizationId);
}

function readCheckoutUrl(body: unknown): string {
  const root = readObject(body, "Vortex Billing checkout response");
  const data = readObject(root.data, "Vortex Billing checkout response data");
  const checkoutSession = readObject(
    data.checkoutSession,
    "Vortex Billing checkout response checkoutSession",
  );
  const checkoutUrl = checkoutSession.checkoutUrl;

  if (typeof checkoutUrl !== "string" || checkoutUrl.length === 0) {
    throw new ConvexError("Vortex Billing checkout response did not include checkoutUrl");
  }

  return checkoutUrl;
}

function readRequiredEnv(env: Env, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === "") {
    throw new ConvexError(`${name} is required for Vortex Billing SaaS checkout`);
  }
  return value;
}

function parseOptionalStringRecord(raw: string | undefined, name: string): Record<string, string> {
  if (raw === undefined || raw.trim() === "") {
    return {};
  }
  return parseStringRecord(raw, name);
}

function parseStringRecord(raw: string, name: string): Record<string, string> {
  const parsed = parseJson(raw, name);
  const object = readObject(parsed, name);
  const record: Record<string, string> = {};

  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new ConvexError(`${name} must map strings to non-empty strings`);
    }
    record[key] = value;
  }

  return record;
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConvexError(`${label} is not valid JSON: ${message}`);
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeExternalIdPart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase();
}

function summarizeJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "unreadable response";
  }
}
