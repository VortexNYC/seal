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
  ratePlanId: string;
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

export function readVortexConnect(metadata: string | null): VortexConnectView {
  const stored = parseMetadata(metadata).vortexConnect;
  if (!isRecord(stored)) {
    return {
      connected: false,
      processor: "vortex",
      merchantAccountId: null,
      claimUrl: null,
      claimExpiresAt: null,
      status: null,
      onboardingSessionId: null,
    };
  }
  const merchantAccountId = stringField(stored, "merchantAccountId");
  if (!merchantAccountId) {
    return {
      connected: false,
      processor: "vortex",
      merchantAccountId: null,
      claimUrl: null,
      claimExpiresAt: null,
      status: null,
      onboardingSessionId: null,
    };
  }
  return {
    connected: true,
    processor: "vortex",
    merchantAccountId,
    claimUrl: stringField(stored, "claimUrl"),
    claimExpiresAt: stringField(stored, "claimExpiresAt"),
    status: stringField(stored, "status"),
    onboardingSessionId: stringField(stored, "onboardingSessionId"),
  };
}

export function withVortexConnect(
  metadata: string | null,
  record: VortexConnectRecord
): string {
  const current = parseMetadata(metadata);
  return JSON.stringify({ ...current, vortexConnect: record });
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
