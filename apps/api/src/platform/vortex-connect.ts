import { z } from "zod";

export const vortexOAuthMerchantSummarySchema = z.object({
  merchantAccountId: z.string().min(1),
  displayName: z.string().min(1),
  environment: z.string().min(1),
  status: z.string().min(1),
  chargesApproved: z.boolean(),
});

export type VortexOAuthMerchantSummary = z.infer<
  typeof vortexOAuthMerchantSummarySchema
>;

export const vortexOAuthOrganizationSummarySchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  role: z.enum(["owner", "admin"]),
  merchants: z.array(vortexOAuthMerchantSummarySchema).default([]),
});

export const vortexOAuthUserMetadataSchema = z.object({
  vortexOrganizations: z
    .array(vortexOAuthOrganizationSummarySchema)
    .default([]),
});

export function readUserVortexOrganizations(
  rawMetadata: unknown
): readonly z.infer<typeof vortexOAuthOrganizationSummarySchema>[] {
  try {
    const obj: unknown =
      typeof rawMetadata === "string" ? JSON.parse(rawMetadata) : rawMetadata;
    const parsed = vortexOAuthUserMetadataSchema.safeParse(obj);
    return parsed.success ? parsed.data.vortexOrganizations : [];
  } catch {
    return [];
  }
}

export function readUserVortexMerchants(
  rawMetadata: unknown
): readonly VortexOAuthMerchantSummary[] {
  return readUserVortexOrganizations(rawMetadata).flatMap(
    (org) => org.merchants
  );
}

export interface VortexConnectEnv {
  VORTEX_API_KEY?: string;
  VORTEX_API_BASE_URL?: string;
  VORTEX_PLATFORM_MERCHANT_ACCOUNT_ID?: string;
  VORTEX_CONNECT_RATE_PLAN_ID?: string;
}

/** Seal's production platform merchant. Not a secret. */
export const SEAL_PLATFORM_MERCHANT_ACCOUNT_ID =
  "ma_96a22a2d2b41472589e27c4f97e5fad5";

/** seal_fleet_standard: 2.9% + 30¢ blended, 0 bps platform take. */
export const SEAL_CONNECT_RATE_PLAN_ID =
  "rate_plan_941bccb0-5eff-4aca-a387-4615f126ff4e";

const DEFAULT_BASE_URL = "https://api.vortex.nyc";

export type VortexConnectRecord = {
  merchantAccountId: string;
  claimUrl: string | null;
  claimExpiresAt: string | null;
  status: string;
  environment: "production";
  ratePlanId: string | null;
  onboardingSessionId: string | null;
};

export type VortexConnectView = {
  connected: boolean;
  processor: "vortex";
  merchantAccountId: string | null;
  claimUrl: string | null;
  claimExpiresAt: string | null;
  status: string | null;
  onboardingSessionId: string | null;
  ratePlanId: string | null;
  chargesApproved: boolean;
  summary: string;
};

export class VortexConnectError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "VortexConnectError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed: unknown = JSON.parse(metadata);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function connectIdempotencyKey(organizationId: string): string {
  return `seal-connect-${organizationId}`;
}

function disconnectedView(): VortexConnectView {
  return {
    connected: false,
    processor: "vortex",
    merchantAccountId: null,
    claimUrl: null,
    claimExpiresAt: null,
    status: null,
    onboardingSessionId: null,
    ratePlanId: null,
    chargesApproved: false,
    summary: "No connected account yet.",
  };
}

function withSummary(
  view: Omit<VortexConnectView, "summary">
): VortexConnectView {
  if (!view.connected) {
    return { ...view, summary: "No connected account yet." };
  }
  if (view.chargesApproved) {
    return { ...view, summary: "Vortex can charge on this account." };
  }
  const status = view.status ?? "draft";
  if (view.claimUrl) {
    return { ...view, summary: `${status}. Finish setup on Vortex.` };
  }
  return {
    ...view,
    summary: `${status}. Finix has not approved this account for charges.`,
  };
}

export function readVortexConnect(metadata: string | null): VortexConnectView {
  const stored = parseMetadata(metadata).vortexConnect;
  if (!isRecord(stored)) {
    return disconnectedView();
  }
  const merchantAccountId = stringField(stored, "merchantAccountId");
  if (!merchantAccountId) {
    return disconnectedView();
  }
  return withSummary({
    connected: true,
    processor: "vortex",
    merchantAccountId,
    claimUrl: stringField(stored, "claimUrl"),
    claimExpiresAt: stringField(stored, "claimExpiresAt"),
    status: stringField(stored, "status"),
    onboardingSessionId: stringField(stored, "onboardingSessionId"),
    ratePlanId: stringField(stored, "ratePlanId"),
    chargesApproved: false,
  });
}

export function withVortexConnect(
  metadata: string | null,
  record: VortexConnectRecord
): string {
  const current = parseMetadata(metadata);
  return JSON.stringify({ ...current, vortexConnect: record });
}

function claimLocation(
  claimUrl: string
): { organizationId: string; token: string } | null {
  let url: URL;
  try {
    url = new URL(claimUrl);
  } catch {
    return null;
  }
  const organizationId = url.pathname.split("/").filter(Boolean).at(-1);
  if (!organizationId) return null;
  const token =
    new URLSearchParams(url.hash.replace(/^#/u, "")).get("token") ??
    url.searchParams.get("token");
  if (!token) return null;
  return { organizationId, token };
}

async function claimLinkUsable(
  claimUrl: string,
  fetchImpl: typeof fetch
): Promise<boolean | null> {
  const location = claimLocation(claimUrl);
  if (!location) return false;
  try {
    const response = await fetchImpl(
      "https://api.vortex.nyc/v1/signup/claim/lookup",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.vortex.nyc",
        },
        body: JSON.stringify(location),
      }
    );
    return response.ok;
  } catch {
    return null;
  }
}

async function vortexGet(
  env: VortexConnectEnv,
  path: string,
  fetchImpl: typeof fetch
): Promise<Record<string, unknown> | null> {
  const apiKey = env.VORTEX_API_KEY;
  if (!apiKey) return null;
  const base = (env.VORTEX_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetchImpl(`${base}${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return null;
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return unwrapData(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export async function presentVortexConnect(
  env: VortexConnectEnv,
  metadata: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<VortexConnectView> {
  const stored = readVortexConnect(metadata);
  if (!stored.connected || !stored.merchantAccountId) {
    return stored;
  }
  const merchant = await vortexGet(
    env,
    `/v1/merchant-accounts/${encodeURIComponent(stored.merchantAccountId)}?environment=production`,
    fetchImpl
  );
  const status = merchant
    ? (stringField(merchant, "status") ?? stored.status)
    : stored.status;
  const capabilityStatus = merchant
    ? stringField(merchant, "capabilityStatus")
    : null;
  const chargesApproved =
    merchant !== null &&
    (capabilityStatus === "enabled" ||
      (status === "active" && capabilityStatus === "active"));
  let claimUrl = stored.claimUrl;
  if (claimUrl) {
    const usable = await claimLinkUsable(claimUrl, fetchImpl);
    if (usable === false) claimUrl = null;
  }
  return withSummary({
    connected: true,
    processor: "vortex",
    merchantAccountId: stored.merchantAccountId,
    claimUrl,
    claimExpiresAt: stored.claimExpiresAt,
    status,
    onboardingSessionId: stored.onboardingSessionId,
    ratePlanId: stored.ratePlanId,
    chargesApproved,
  });
}

function unwrapData(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  if (isRecord(body.data)) return body.data;
  return body;
}

function errorMessage(body: unknown, status: number): string {
  const record = unwrapData(body);
  const message = record ? stringField(record, "message") : null;
  return message ?? `Vortex returned ${status}`;
}

async function vortexPost(
  env: VortexConnectEnv,
  path: string,
  idempotencyKey: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<Record<string, unknown>> {
  const apiKey = env.VORTEX_API_KEY;
  if (!apiKey) {
    throw new VortexConnectError(503, "payments_not_configured");
  }
  const base = (env.VORTEX_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetchImpl(`${base}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    throw new VortexConnectError(
      response.status,
      errorMessage(parsed, response.status)
    );
  }
  const data = unwrapData(parsed);
  if (!data) {
    throw new VortexConnectError(502, "Vortex returned an empty body");
  }
  return data;
}

export async function provisionConnectedAccount(
  env: VortexConnectEnv,
  input: {
    organizationId: string;
    displayName: string;
    legalEntityType: string;
    country: string;
    defaultCurrency: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<VortexConnectRecord> {
  const platformMerchantAccountId =
    env.VORTEX_PLATFORM_MERCHANT_ACCOUNT_ID ??
    SEAL_PLATFORM_MERCHANT_ACCOUNT_ID;
  const ratePlanId =
    env.VORTEX_CONNECT_RATE_PLAN_ID ?? SEAL_CONNECT_RATE_PLAN_ID;
  const idempotencyKey = connectIdempotencyKey(input.organizationId);
  const created = await vortexPost(
    env,
    "/v1/merchant-accounts?environment=production",
    idempotencyKey,
    {
      environment: "production",
      idempotencyKey,
      platformMerchantAccountId,
      ratePlanId,
      displayName: input.displayName,
      legalEntityType: input.legalEntityType,
      country: input.country,
      merchantMode: "processing",
      defaultCurrency: input.defaultCurrency,
      externalMerchantRef: input.organizationId,
      metadata: {
        sourceSystem: "seal",
        sealOrganizationId: input.organizationId,
      },
    },
    fetchImpl
  );
  const merchantAccountId = stringField(created, "id");
  if (!merchantAccountId) {
    throw new VortexConnectError(502, "Vortex did not return a merchant id");
  }

  let onboardingSessionId: string | null = null;
  try {
    const draft = await vortexPost(
      env,
      `/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/onboarding-link?environment=production`,
      `${idempotencyKey}-onboarding`,
      { environment: "production" },
      fetchImpl
    );
    onboardingSessionId = stringField(draft, "onboardingSessionId");
  } catch {
    onboardingSessionId = null;
  }

  return {
    merchantAccountId,
    claimUrl: stringField(created, "claimUrl"),
    claimExpiresAt: stringField(created, "claimExpiresAt"),
    status: stringField(created, "status") ?? "draft",
    environment: "production",
    ratePlanId,
    onboardingSessionId,
  };
}

/**
 * SEA-121 — attach an existing Vortex merchant onto a Seal workspace without
 * assigning `seal_fleet_standard` (preserving the merchant's existing Vortex
 * rate plan).
 */
export async function attachConnectedAccount(
  env: VortexConnectEnv,
  input: {
    merchantAccountId: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<VortexConnectRecord> {
  const environment = env.VORTEX_API_KEY?.startsWith("vp_test")
    ? "sandbox"
    : "production";
  const merchant = await vortexGet(
    env,
    `/v1/merchant-accounts/${encodeURIComponent(input.merchantAccountId)}?environment=${environment}`,
    fetchImpl
  );
  if (merchant === null) {
    throw new VortexConnectError(404, "Vortex merchant account not found");
  }
  return {
    merchantAccountId: input.merchantAccountId,
    claimUrl: null,
    claimExpiresAt: null,
    status: stringField(merchant, "status") ?? "draft",
    environment: "production",
    ratePlanId: null,
    onboardingSessionId: null,
  };
}

export interface MintSignToPayCheckoutSessionInput {
  readonly merchantAccountId: string;
  readonly idempotencyKey: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly payerEmail: string;
  readonly dueDate?: string | null;
  readonly description: string;
  readonly environment?: "sandbox" | "production";
}

export interface MintSignToPayCheckoutSessionResult {
  readonly checkoutSessionId: string;
  readonly paymentRequestId: string;
  readonly checkoutUrl: string | null;
  readonly providerInvoiceId: string | null;
}

/**
 * SEA-123 / SEA-124 — mint an ad-hoc one-time payable + hosted `/pay` link on
 * the connected Vortex merchant when the last required signature lands.
 */
export async function mintSignToPayCheckoutSession(
  env: VortexConnectEnv,
  input: MintSignToPayCheckoutSessionInput,
  fetchImpl: typeof fetch = fetch
): Promise<MintSignToPayCheckoutSessionResult> {
  const environment =
    input.environment ??
    (env.VORTEX_API_KEY?.startsWith("vp_test") ? "sandbox" : "production");
  const data = await vortexPost(
    env,
    `/v1/checkout/sessions?environment=${environment}`,
    input.idempotencyKey,
    {
      environment,
      merchantAccountId: input.merchantAccountId,
      mode: "payment",
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      payerEmail: input.payerEmail,
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      description: input.description,
    },
    fetchImpl
  );
  const session = isRecord(data.checkoutSession) ? data.checkoutSession : data;
  const paymentRequestId = stringField(session, "paymentRequestId");
  const checkoutSessionId = stringField(session, "checkoutSessionId");
  if (!paymentRequestId || !checkoutSessionId) {
    throw new VortexConnectError(
      502,
      "Vortex did not return a paymentRequestId/checkoutSessionId"
    );
  }
  const invoiceNumbers = Array.isArray(session.invoiceNumbers)
    ? session.invoiceNumbers
    : [];
  const providerInvoiceId =
    typeof invoiceNumbers[0] === "string" && invoiceNumbers[0].length > 0
      ? invoiceNumbers[0]
      : null;
  return {
    checkoutSessionId,
    paymentRequestId,
    checkoutUrl: stringField(session, "checkoutUrl"),
    providerInvoiceId,
  };
}
