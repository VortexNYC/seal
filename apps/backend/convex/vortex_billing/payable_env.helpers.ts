import { ConvexError } from "convex/values";

type Env = {
  readonly [key: string]: string | undefined;
};

export type VortexBillingEnvInput = {
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly sourceNamespace?: string;
  readonly customerMapJson?: string;
  readonly billingAccountMapJson?: string;
  readonly defaultBillingAccountId?: string;
  readonly merchantAccountMapJson?: string;
  readonly defaultMerchantAccountId?: string;
  readonly paymentsEnvironment?: string;
  readonly priceMapJson?: string;
  readonly defaultPriceId?: string;
};

export type VortexBillingEnv = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly sourceNamespace: string;
  readonly paymentsEnvironment: string;
  readonly customerMap: Record<string, string>;
  readonly billingAccountMap: Record<string, string>;
  readonly defaultBillingAccountId?: string;
  readonly merchantAccountMap: Record<string, string>;
  readonly defaultMerchantAccountId?: string;
  readonly priceMap: Record<string, string>;
  readonly defaultPriceId?: string;
};

const API_BASE_URL_ENV = "VORTEX_BILLING_API_BASE_URL";
const API_KEY_ENV = "VORTEX_BILLING_API_KEY";
const SOURCE_NAMESPACE_ENV = "VORTEX_BILLING_SOURCE_NAMESPACE";
const DOCUMENT_CUSTOMER_MAP_ENV = "VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP";
const SHARED_CUSTOMER_MAP_ENV = "VORTEX_BILLING_CUSTOMER_MAP";
const DOCUMENT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP";
const SHARED_ACCOUNT_MAP_ENV = "VORTEX_BILLING_ACCOUNT_MAP";
const DOCUMENT_DEFAULT_ACCOUNT_ID_ENV = "VORTEX_BILLING_DOCUMENT_ACCOUNT_ID";
const SHARED_ACCOUNT_ID_ENV = "VORTEX_BILLING_ACCOUNT_ID";
const DOCUMENT_MERCHANT_ACCOUNT_MAP_ENV =
  "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP";
const SHARED_MERCHANT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_MERCHANT_ACCOUNT_MAP";
const DOCUMENT_DEFAULT_MERCHANT_ACCOUNT_ID_ENV =
  "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_ID";
const SHARED_MERCHANT_ACCOUNT_ID_ENV = "VORTEX_BILLING_MERCHANT_ACCOUNT_ID";
const DOCUMENT_PRICE_MAP_ENV = "VORTEX_BILLING_DOCUMENT_PRICE_MAP";
const SHARED_PRICE_MAP_ENV = "VORTEX_BILLING_PRICE_MAP";
const DOCUMENT_DEFAULT_PRICE_ID_ENV = "VORTEX_BILLING_DOCUMENT_PRICE_ID";
const SHARED_PRICE_ID_ENV = "VORTEX_BILLING_PRICE_ID";
const PAYMENTS_ENVIRONMENT_ENV = "VORTEX_BILLING_PAYMENTS_ENVIRONMENT";

export function readVortexBillingEnv(
  input: VortexBillingEnvInput
): VortexBillingEnv {
  const customerMap = parseOptionalStringRecord(
    input.customerMapJson,
    "customerMapJson"
  );
  const billingAccountMap = parseOptionalStringRecord(
    input.billingAccountMapJson,
    "billingAccountMapJson"
  );
  const merchantAccountMap = parseOptionalStringRecord(
    input.merchantAccountMapJson,
    "merchantAccountMapJson"
  );
  const priceMap = parseOptionalStringRecord(
    input.priceMapJson,
    "priceMapJson"
  );

  return {
    apiBaseUrl: readRequiredValue(input.apiBaseUrl, "apiBaseUrl"),
    apiKey: readRequiredValue(input.apiKey, "apiKey"),
    sourceNamespace: input.sourceNamespace ?? "seal",
    paymentsEnvironment: input.paymentsEnvironment ?? "sandbox",
    customerMap,
    billingAccountMap,
    defaultBillingAccountId: input.defaultBillingAccountId,
    merchantAccountMap,
    defaultMerchantAccountId: input.defaultMerchantAccountId,
    priceMap,
    defaultPriceId: input.defaultPriceId,
  };
}

export function readVortexBillingEnvFromProcess(
  env: Env = process.env
): VortexBillingEnv {
  return readVortexBillingEnv({
    apiBaseUrl: env[API_BASE_URL_ENV],
    apiKey: env[API_KEY_ENV],
    sourceNamespace: env[SOURCE_NAMESPACE_ENV] ?? "seal",
    customerMapJson:
      env[DOCUMENT_CUSTOMER_MAP_ENV] ?? env[SHARED_CUSTOMER_MAP_ENV],
    billingAccountMapJson:
      env[DOCUMENT_ACCOUNT_MAP_ENV] ?? env[SHARED_ACCOUNT_MAP_ENV],
    defaultBillingAccountId:
      env[DOCUMENT_DEFAULT_ACCOUNT_ID_ENV] ?? env[SHARED_ACCOUNT_ID_ENV],
    merchantAccountMapJson:
      env[DOCUMENT_MERCHANT_ACCOUNT_MAP_ENV] ??
      env[SHARED_MERCHANT_ACCOUNT_MAP_ENV],
    defaultMerchantAccountId:
      env[DOCUMENT_DEFAULT_MERCHANT_ACCOUNT_ID_ENV] ??
      env[SHARED_MERCHANT_ACCOUNT_ID_ENV],
    paymentsEnvironment: env[PAYMENTS_ENVIRONMENT_ENV] ?? "sandbox",
    priceMapJson: env[DOCUMENT_PRICE_MAP_ENV] ?? env[SHARED_PRICE_MAP_ENV],
    defaultPriceId:
      env[DOCUMENT_DEFAULT_PRICE_ID_ENV] ?? env[SHARED_PRICE_ID_ENV],
  });
}

function readRequiredValue(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === "") {
    throw new ConvexError(
      `Vortex Billing ${label} is required for document payments`
    );
  }
  return value;
}

function parseOptionalStringRecord(
  raw: string | undefined,
  name: string
): Record<string, string> {
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
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = entry;
  }
  return result;
}
