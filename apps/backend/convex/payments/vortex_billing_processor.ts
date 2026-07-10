"use node";

import {
  applyCoupon,
  createClient,
  createCheckoutSession,
  listCoupons,
  terminateAppliedCoupon,
} from "@vortexnyc/payments-sdk";

type VortexBillingClient = ReturnType<typeof createClient>;
import { ConvexError } from "convex/values";

import { requestVortexBillingJson } from "../vortex_billing/payable_actions";
import type { Env } from "./saas_billing_provider";

export { selectSaasBillingProvider } from "./saas_billing_provider";
export type { SaasBillingProvider } from "./saas_billing_provider";

export type VortexBillingCheckoutArgs = {
  readonly organizationId: string;
  readonly lookupKey: string;
  readonly quantity: number;
  readonly promoCode?: string;
  readonly priceId?: string;
  readonly priceUnitAmount?: number;
};

export type VortexBillingPortalArgs = {
  readonly organizationId: string;
};

type VortexBillingApiConfig = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
};

type VortexBillingConfig = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly billingAccountId: string;
  readonly priceId: string;
  readonly customerExternalId: string;
  readonly subscriptionExternalId: string;
};

type VortexCoupon = {
  readonly couponId: string;
  readonly code: string;
  readonly status: "active";
  readonly expiresAt?: string;
  readonly targets: {
    readonly priceIds?: readonly string[];
  };
};

type AppliedVortexCoupon = {
  readonly couponId: string;
  readonly appliedCouponId: string;
};

export type VortexCheckoutSession = {
  readonly checkoutUrl: string;
  readonly amountTotal: number;
  readonly amountRemaining: number;
  readonly invoiceNumbers: readonly string[];
};

type VortexBillingPortalConfig = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly customerExternalId: string;
};

const API_BASE_URL_ENV = "VORTEX_BILLING_API_BASE_URL";
const API_KEY_ENV = "VORTEX_BILLING_API_KEY";
const ACCOUNT_ID_ENV = "VORTEX_BILLING_ACCOUNT_ID";
const ACCOUNT_MAP_ENV = "VORTEX_BILLING_ACCOUNT_MAP";
const CUSTOMER_MAP_ENV = "VORTEX_BILLING_CUSTOMER_MAP";
const PRICE_MAP_ENV = "VORTEX_BILLING_SAAS_PRICE_MAP";

export async function createVortexBillingCheckoutSession(
  args: VortexBillingCheckoutArgs,
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const checkoutSession = await createVortexBillingCheckoutSessionDetails(args, env, fetchImpl);
  return checkoutSession.checkoutUrl;
}

export async function createVortexBillingCheckoutSessionDetails(
  args: VortexBillingCheckoutArgs,
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): Promise<VortexCheckoutSession> {
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
  const promoCode = normalizePromoCode(args.promoCode);
  let appliedCoupon: AppliedVortexCoupon | undefined;
  assertCouponCheckoutHasPrice(args, config, promoCode);

  if (promoCode !== undefined) {
    const coupon = await resolveActiveVortexCoupon({
      client: billingClient,
      promoCode,
      priceId: config.priceId,
    });
    const appliedCouponId = buildAppliedCouponId(args, coupon.couponId);
    appliedCoupon = await applyVortexCoupon({
      client: billingClient,
      couponId: coupon.couponId,
      appliedCouponId,
      customerExternalId: config.customerExternalId,
      billingAccountId: config.billingAccountId,
      organizationId: args.organizationId,
      lookupKey: args.lookupKey,
    });
  }

  try {
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

    const checkoutSession = readCheckoutSession(data);
    if (appliedCoupon !== undefined) {
      assertCheckoutDiscountReflected(
        checkoutSession,
        args.priceUnitAmount,
        args.quantity,
        appliedCoupon,
      );
    }

    return checkoutSession;
  } catch (error) {
    if (appliedCoupon !== undefined) {
      await terminateAppliedCouponAfterCheckoutFailure(
        {
          client: billingClient,
          appliedCoupon,
          organizationId: args.organizationId,
          lookupKey: args.lookupKey,
        },
        error,
      );
    }
    throw error;
  }
}

export async function createVortexBillingPortalSession(
  args: VortexBillingPortalArgs,
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const config = resolveVortexBillingPortalConfig(args, env);
  const billingClient = createClient({
    baseUrl: trimTrailingSlash(config.apiBaseUrl),
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "x-vortex-service": "billing",
    },
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  const idempotencyKey = `seal-saas-portal:${args.organizationId}`;

  const { data, error, response } = await billingClient.post({
    url: "/v1/customers/{customerExternalId}/portal-links",
    path: { customerExternalId: config.customerExternalId },
    parseAs: "json",
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      createdByRef: "seal-saas-billing-settings",
    },
  });

  if (error !== undefined || response === undefined || !response.ok) {
    const status = response?.status ?? "no-response";
    throw new ConvexError(
      `Vortex Billing portal failed (${status}): ${summarizeJson(error ?? data)}`,
    );
  }

  return readPortalUrl(data);
}

export function resolveVortexBillingConfig(
  args: VortexBillingCheckoutArgs,
  env: Env = process.env,
): VortexBillingConfig {
  const apiConfig = resolveVortexBillingApiConfig(env);
  const priceMap = parseOptionalStringRecord(env[PRICE_MAP_ENV], PRICE_MAP_ENV);
  const accountMap = parseOptionalStringRecord(env[ACCOUNT_MAP_ENV], ACCOUNT_MAP_ENV);
  const customerMap = parseOptionalStringRecord(env[CUSTOMER_MAP_ENV], CUSTOMER_MAP_ENV);

  const priceId = args.priceId ?? resolveVortexBillingPriceId(args.lookupKey, priceMap);

  const organizationKey = String(args.organizationId);
  const billingAccountId = accountMap[organizationKey] ?? env[ACCOUNT_ID_ENV];
  if (!billingAccountId) {
    throw new ConvexError(`Vortex Billing account missing for organization: ${organizationKey}`);
  }

  const customerExternalId = readVortexBillingCustomerExternalId(organizationKey, customerMap);
  const subscriptionExternalId = `vtx_sub_seal_org_${organizationKey}_${normalizeExternalIdPart(
    args.lookupKey,
  )}`;

  return {
    apiBaseUrl: apiConfig.apiBaseUrl,
    apiKey: apiConfig.apiKey,
    billingAccountId,
    priceId,
    customerExternalId,
    subscriptionExternalId,
  };
}

function assertCouponCheckoutHasPrice(
  args: VortexBillingCheckoutArgs,
  config: VortexBillingConfig,
  promoCode: string | undefined,
): void {
  if (promoCode !== undefined && args.priceUnitAmount === undefined) {
    throw new ConvexError(
      `Seal subscription price missing unitAmount for Vortex coupon checkout priceId: ${config.priceId}`,
    );
  }
}

function resolveVortexBillingPriceId(lookupKey: string, priceMap: Record<string, string>): string {
  const mappedPriceId = priceMap[lookupKey];
  if (mappedPriceId !== undefined && mappedPriceId.length > 0) {
    return mappedPriceId;
  }
  if (lookupKey.startsWith("vtx_price")) {
    return lookupKey;
  }
  throw new ConvexError(`Vortex Billing price missing for lookup key: ${lookupKey}`);
}

export function resolveVortexBillingPortalConfig(
  args: VortexBillingPortalArgs,
  env: Env = process.env,
): VortexBillingPortalConfig {
  const apiConfig = resolveVortexBillingApiConfig(env);

  return {
    ...apiConfig,
    customerExternalId: resolveVortexBillingCustomerExternalId(args.organizationId, env),
  };
}

function resolveVortexBillingApiConfig(env: Env): VortexBillingApiConfig {
  return {
    apiBaseUrl: readRequiredEnv(env, API_BASE_URL_ENV),
    apiKey: readRequiredEnv(env, API_KEY_ENV),
  };
}

export function resolveVortexBillingCustomerExternalId(organizationId: string, env: Env): string {
  const organizationKey = String(organizationId);
  const customerMap = parseOptionalStringRecord(env[CUSTOMER_MAP_ENV], CUSTOMER_MAP_ENV);
  return readVortexBillingCustomerExternalId(organizationKey, customerMap);
}

function readVortexBillingCustomerExternalId(
  organizationKey: string,
  customerMap: Record<string, string>,
): string {
  return customerMap[organizationKey] ?? `vtx_cust_seal_org_${organizationKey}`;
}

export async function resolveActiveVortexCoupon(input: {
  readonly client: VortexBillingClient;
  readonly promoCode: string;
  readonly priceId: string;
}): Promise<VortexCoupon> {
  const { data, error, response } = await listCoupons({ client: input.client });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing coupon resolution failed (${response?.status ?? "no-response"})`,
    );
  }
  const coupon = readCouponList(data).find((candidate) => candidate.code === input.promoCode);
  if (coupon === undefined) {
    throw new ConvexError("Vortex Billing coupon code is invalid or inactive");
  }
  validateActiveVortexCoupon(coupon, input.priceId);
  return coupon;
}

/**
 * Read a Vortex product entitlement for a customer (VOR-67).
 *
 * Product access is owned by Vortex Payments (billing-derived), not auth. Seal — like
 * any Vortex Connect consumer — reads it through the same dev surface. Keys are namespaced
 * `vortex.<product>` to avoid collision with merchants' own entitlement catalogs. This is
 * the product-entitlement dimension only; money-in readiness (sub-merchant onboarding) is a
 * separate read gated as `entitled AND moneyInReady`.
 */
export async function readVortexProductAccess(
  input: {
    readonly apiBaseUrl: string;
    readonly apiKey: string;
    readonly customerExternalId: string;
    readonly product: string;
  },
  fetcher: (input: string, init: RequestInit) => Promise<Response>,
): Promise<{ readonly product: string; readonly entitlementKey: string; readonly entitled: boolean }> {
  const entitlementKey = `vortex.${input.product}`;
  const body = await requestVortexBillingJson(
    {
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      method: "GET",
      path: `/v1/customers/${encodeURIComponent(input.customerExternalId)}/entitlements?key=${encodeURIComponent(
        entitlementKey,
      )}`,
      failureLabel: "Vortex Billing product-access read",
    },
    fetcher,
  );
  return { product: input.product, entitlementKey, entitled: isVortexEntitlementKeyActive(body, entitlementKey) };
}

/** Defensive parse: entitled iff the key appears in the response's active entitlement keys. */
function isVortexEntitlementKeyActive(body: unknown, entitlementKey: string): boolean {
  if (typeof body !== "object" || body === null) return false;
  const data = (body as { readonly data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  const entitlements = (data as { readonly entitlements?: unknown }).entitlements;
  if (typeof entitlements !== "object" || entitlements === null) return false;
  const activeKeys = (entitlements as { readonly activeKeys?: unknown }).activeKeys;
  return Array.isArray(activeKeys) && activeKeys.includes(entitlementKey);
}

export async function applyVortexCoupon(
  input: {
    readonly client: VortexBillingClient;
    readonly couponId: string;
    readonly appliedCouponId: string;
    readonly customerExternalId: string;
    readonly billingAccountId: string;
    readonly organizationId: string;
    readonly lookupKey: string;
  },
): Promise<AppliedVortexCoupon> {
  const { data: responseBody, error, response } = await applyCoupon({
    client: input.client,
    path: { couponId: input.couponId },
    headers: {
      "Idempotency-Key": `seal-saas-coupon-apply:${input.organizationId}:${normalizeExternalIdPart(
        input.lookupKey,
      )}:${normalizeExternalIdPart(input.couponId)}`,
    },
    body: {
      appliedCouponId: input.appliedCouponId,
      customerExternalId: input.customerExternalId,
      billingAccountId: input.billingAccountId,
      metadata: {
        sourceSystem: "seal",
        sealOrganizationId: input.organizationId,
        lookupKey: input.lookupKey,
      },
    },
  });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing coupon apply failed (${response?.status ?? "no-response"})`,
    );
  }
  const root = readObject(responseBody, "Vortex Billing coupon apply response");
  const data = readObject(root.data, "Vortex Billing coupon apply response data");
  const appliedCouponBody = readObject(
    data.appliedCoupon,
    "Vortex Billing coupon apply response appliedCoupon",
  );
  const appliedCouponId = readString(
    appliedCouponBody.appliedCouponId,
    "Vortex Billing applied coupon id",
  );

  if (appliedCouponId !== input.appliedCouponId) {
    throw new ConvexError(
      `Vortex Billing coupon apply returned unexpected appliedCouponId: ${appliedCouponId}`,
    );
  }

  return {
    couponId: input.couponId,
    appliedCouponId,
  };
}

export async function terminateVortexAppliedCoupon(input: {
  readonly client: VortexBillingClient;
  readonly appliedCouponId: string;
  readonly organizationId: string;
  readonly lookupKey: string;
}): Promise<void> {
  const { error, response } = await terminateAppliedCoupon({
    client: input.client,
    path: { appliedCouponId: input.appliedCouponId },
    headers: {
      "Idempotency-Key": `seal-saas-coupon-terminate:${input.organizationId}:${normalizeExternalIdPart(
        input.lookupKey,
      )}:${normalizeExternalIdPart(input.appliedCouponId)}`,
    },
    body: { terminatedAt: new Date().toISOString() },
  });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing applied coupon cleanup failed (${response?.status ?? "no-response"})`,
    );
  }
}

function readCheckoutSession(body: unknown): VortexCheckoutSession {
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

  return {
    checkoutUrl,
    amountTotal: readNumber(checkoutSession.amountTotal, "Vortex Billing checkout amountTotal"),
    amountRemaining: readNumber(
      checkoutSession.amountRemaining,
      "Vortex Billing checkout amountRemaining",
    ),
    invoiceNumbers: readStringArray(
      checkoutSession.invoiceNumbers,
      "Vortex Billing checkout invoiceNumbers",
    ),
  };
}

function readPortalUrl(body: unknown): string {
  const root = readObject(body, "Vortex Billing portal response");
  const data = readObject(root.data, "Vortex Billing portal response data");
  const link = readObject(data.link, "Vortex Billing portal response link");
  const portalUrl = link.url;

  if (typeof portalUrl !== "string" || portalUrl.length === 0) {
    throw new ConvexError("Vortex Billing portal response did not include link.url");
  }

  return portalUrl;
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

function readCouponList(body: unknown): readonly VortexCoupon[] {
  const root = readObject(body, "Vortex Billing coupon list response");
  const data = root.data;
  if (!Array.isArray(data)) {
    throw new ConvexError("Vortex Billing coupon list response data must be an array");
  }

  // The SDK's GET /v1/coupons exposes no status filter (bespoke used ?status=active), so it
  // returns all coupons; keep only active ones before strict parsing to preserve behavior.
  return data
    .filter(
      (entry) =>
        (readObject(entry, "Vortex Billing coupon") as { readonly status?: unknown }).status ===
        "active",
    )
    .map(readVortexCoupon);
}

function readVortexCoupon(value: unknown): VortexCoupon {
  const coupon = readObject(value, "Vortex Billing coupon");
  const status = coupon.status;
  if (status !== "active") {
    throw new ConvexError("Vortex Billing coupon list returned a non-active coupon");
  }
  return {
    couponId: readString(coupon.couponId, "Vortex Billing coupon id"),
    code: readString(coupon.code, "Vortex Billing coupon code"),
    status,
    expiresAt: readOptionalString(coupon.expiresAt, "Vortex Billing coupon expiresAt"),
    targets: readCouponTargets(coupon.targets),
  };
}

function readCouponTargets(value: unknown): VortexCoupon["targets"] {
  if (value === undefined || value === null) {
    return {};
  }
  const targets = readObject(value, "Vortex Billing coupon targets");
  return {
    priceIds:
      targets.priceIds === undefined || targets.priceIds === null
        ? undefined
        : readStringArray(targets.priceIds, "Vortex Billing coupon target priceIds"),
  };
}

function validateActiveVortexCoupon(coupon: VortexCoupon, priceId: string): void {
  if (coupon.status !== "active") {
    throw new ConvexError("Vortex Billing coupon code is invalid or inactive");
  }
  if (coupon.expiresAt !== undefined) {
    const expiry = Date.parse(coupon.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      throw new ConvexError("Vortex Billing coupon code is expired");
    }
  }
  if (coupon.targets.priceIds !== undefined && !coupon.targets.priceIds.includes(priceId)) {
    throw new ConvexError("Vortex Billing coupon code is not valid for this checkout price");
  }
}

function assertCheckoutDiscountReflected(
  checkoutSession: VortexCheckoutSession,
  priceUnitAmount: number | undefined,
  quantity: number,
  appliedCoupon: AppliedVortexCoupon,
): void {
  if (priceUnitAmount === undefined) {
    throw new ConvexError("Vortex Billing checkout discount cannot be verified without unitAmount");
  }
  const expectedSubtotal = priceUnitAmount * quantity;
  if (checkoutSession.amountTotal < expectedSubtotal) {
    return;
  }
  throw new ConvexError(
    `Vortex Billing checkout did not reflect applied coupon ${appliedCoupon.appliedCouponId}: amountTotal ${checkoutSession.amountTotal} was not below ${expectedSubtotal}`,
  );
}

async function terminateAppliedCouponAfterCheckoutFailure(
  input: {
    readonly client: VortexBillingClient;
    readonly appliedCoupon: AppliedVortexCoupon;
    readonly organizationId: string;
    readonly lookupKey: string;
  },
  originalError: unknown,
): Promise<void> {
  try {
    await terminateVortexAppliedCoupon({
      client: input.client,
      appliedCouponId: input.appliedCoupon.appliedCouponId,
      organizationId: input.organizationId,
      lookupKey: input.lookupKey,
    });
  } catch (cleanupError) {
    throw new ConvexError(
      `Vortex Billing checkout failed and applied coupon cleanup failed for ${input.appliedCoupon.appliedCouponId}: cleanup=${summarizeJson(
        cleanupError,
      )}; original=${summarizeJson(originalError)}`,
    );
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readString(value, label);
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError(`${label} must be a finite number`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ConvexError(`${label} must be an array`);
  }
  return value.map((entry) => readString(entry, label));
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizePromoCode(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildAppliedCouponId(args: VortexBillingCheckoutArgs, couponId: string): string {
  return `seal-saas-coupon:${args.organizationId}:${normalizeExternalIdPart(args.lookupKey)}:${couponId}`;
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

  // Preserve diagnostic detail for Error values (e.g. JSON parse failures or
  // network/transport errors surfaced by the SDK), which would otherwise
  // JSON.stringify to "{}" and lose the message.
  if (value instanceof Error) {
    return value.message.length > 0 ? `${value.name}: ${value.message}` : value.name;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "unreadable response";
  }
}
