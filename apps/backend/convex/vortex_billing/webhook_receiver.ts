export type VortexWebhookSignatureVerificationResult =
  | {
      readonly ok: true;
      readonly timestamp: number;
      readonly signature: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "missing_header"
        | "invalid_header"
        | "invalid_timestamp"
        | "timestamp_outside_tolerance"
        | "invalid_signature";
    };

type VerifyVortexWebhookSignatureInput = {
  readonly payload: string;
  readonly header: string | null | undefined;
  readonly secret: string;
  readonly toleranceSeconds?: number;
  readonly now?: number;
};

type CreateVortexWebhookSignatureInput = {
  readonly payload: string;
  readonly secret: string;
  readonly timestamp?: number;
};

type ParsedVortexWebhookEvent = {
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
};

export type VortexPayableUpdatedProjection = {
  readonly vortexPayableId: string;
  readonly vortexStatus: string;
  readonly vortexPaymentRequestId?: string;
  readonly hostedInvoiceUrl?: string;
};

export type VortexSubscriptionProjection = {
  readonly vortexSubscriptionId: string;
  readonly vortexCustomerId: string;
  readonly vortexPriceId: string;
  readonly status: "active" | "canceled" | "past_due" | "trialing" | "incomplete" | "incomplete_expired" | "unpaid";
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodStart: number;
  readonly currentPeriodEnd: number;
  readonly sealOrganizationId?: string;
  readonly latestInvoiceId?: string;
  readonly canceledAt?: number;
  readonly cancelReason?: string;
};

const defaultToleranceSeconds = 5 * 60;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (value.length % 2 !== 0 || !/^[a-f0-9]+$/iu.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function parseSignatureHeader(
  header: string | null | undefined,
): { readonly timestamp: number; readonly signatures: readonly string[] } | null {
  if (header === null || header === undefined || header.length === 0) {
    return null;
  }

  let rawTimestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, ...valueParts] = part.trim().split("=");
    const value = valueParts.join("=");
    if (key === "t") {
      rawTimestamp = value;
    }
    if (key === "v1" && value.length > 0) {
      signatures.push(value);
    }
  }
  if (rawTimestamp === undefined || signatures.length === 0) {
    return null;
  }

  const timestamp = Number(rawTimestamp);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return null;
  }

  return { timestamp, signatures };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

export async function createVortexWebhookSignature(input: CreateVortexWebhookSignatureInput) {
  const timestamp = input.timestamp ?? Date.now();
  const signature = await hmacSha256Hex(input.secret, `${timestamp}.${input.payload}`);
  return {
    header: `t=${timestamp},v1=${signature}`,
    timestamp,
    signature,
  };
}

export async function verifyVortexWebhookSignature(
  input: VerifyVortexWebhookSignatureInput,
): Promise<VortexWebhookSignatureVerificationResult> {
  const parsed = parseSignatureHeader(input.header);
  if (input.header === null || input.header === undefined || input.header.length === 0) {
    return { ok: false, reason: "missing_header" };
  }
  if (!parsed) {
    return { ok: false, reason: "invalid_header" };
  }

  const toleranceMs = (input.toleranceSeconds ?? defaultToleranceSeconds) * 1000;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(toleranceMs) || toleranceMs < 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  if (Math.abs(now - parsed.timestamp) > toleranceMs) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  const expected = await hmacSha256Hex(input.secret, `${parsed.timestamp}.${input.payload}`);
  const expectedBytes = hexToBytes(expected);
  if (!expectedBytes) {
    return { ok: false, reason: "invalid_signature" };
  }
  for (const signature of parsed.signatures) {
    const actualBytes = hexToBytes(signature);
    if (actualBytes && constantTimeEqual(expectedBytes, actualBytes)) {
      return {
        ok: true,
        timestamp: parsed.timestamp,
        signature,
      };
    }
  }

  return { ok: false, reason: "invalid_signature" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseVortexBillingWebhookEvent(payload: string): ParsedVortexWebhookEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.id !== "string" || typeof parsed.type !== "string") {
    return null;
  }

  return {
    id: parsed.id,
    type: parsed.type,
    data: isRecord(parsed.data) ? parsed.data : {},
  };
}

export function extractVortexPayableUpdatedProjection(
  event: ParsedVortexWebhookEvent,
): VortexPayableUpdatedProjection | null {
  if (event.type !== "payable_object.updated") {
    return null;
  }

  const payableObject = event.data.payableObject;
  if (!isRecord(payableObject)) {
    return null;
  }
  const payableId = payableObject.payableId;
  const status = payableObject.status;
  if (typeof payableId !== "string" || payableId.length === 0) {
    return null;
  }
  if (typeof status !== "string" || status.length === 0) {
    return null;
  }

  const lineage = isRecord(payableObject.lineage) ? payableObject.lineage : {};
  const paymentRequestId = lineage.paymentRequestId;
  const checkoutUrl = lineage.checkoutUrl;

  return {
    vortexPayableId: payableId,
    vortexStatus: status,
    vortexPaymentRequestId:
      typeof paymentRequestId === "string" && paymentRequestId.length > 0
        ? paymentRequestId
        : undefined,
    hostedInvoiceUrl:
      typeof checkoutUrl === "string" && checkoutUrl.length > 0 ? checkoutUrl : undefined,
  };
}

function timestampMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isVortexSubscriptionStatus(value: unknown): value is VortexSubscriptionProjection["status"] {
  return (
    value === "active" ||
    value === "canceled" ||
    value === "past_due" ||
    value === "trialing" ||
    value === "incomplete" ||
    value === "incomplete_expired" ||
    value === "unpaid"
  );
}

export function extractVortexSubscriptionProjection(
  event: ParsedVortexWebhookEvent,
): VortexSubscriptionProjection | null {
  if (event.type !== "subscription.updated" && event.type !== "subscription.canceled") {
    return null;
  }

  const subscription = event.data.subscription;
  if (!isRecord(subscription)) {
    return null;
  }

  const subscriptionExternalId = subscription.subscriptionExternalId;
  const customerExternalId = subscription.customerExternalId;
  const planCode = subscription.planCode;
  const status = subscription.status;
  const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
  const currentPeriodStart = timestampMillis(subscription.currentPeriodStart);
  const currentPeriodEnd = timestampMillis(subscription.currentPeriodEnd);
  if (
    typeof subscriptionExternalId !== "string" ||
    subscriptionExternalId.length === 0 ||
    typeof customerExternalId !== "string" ||
    customerExternalId.length === 0 ||
    typeof planCode !== "string" ||
    planCode.length === 0 ||
    !isVortexSubscriptionStatus(status) ||
    typeof cancelAtPeriodEnd !== "boolean" ||
    currentPeriodStart === null ||
    currentPeriodEnd === null
  ) {
    return null;
  }

  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const sealOrganizationId = metadata.sealOrganizationId;
  const latestInvoiceId = subscription.latestInvoiceId;
  const canceledAt = timestampMillis(subscription.canceledAt);
  const cancelReason = subscription.cancelReason;

  return {
    vortexSubscriptionId: subscriptionExternalId,
    vortexCustomerId: customerExternalId,
    vortexPriceId: planCode,
    status,
    cancelAtPeriodEnd,
    currentPeriodStart,
    currentPeriodEnd,
    sealOrganizationId:
      typeof sealOrganizationId === "string" && sealOrganizationId.length > 0
        ? sealOrganizationId
        : undefined,
    latestInvoiceId:
      typeof latestInvoiceId === "string" && latestInvoiceId.length > 0
        ? latestInvoiceId
        : undefined,
    canceledAt: canceledAt ?? undefined,
    cancelReason:
      typeof cancelReason === "string" && cancelReason.length > 0
        ? cancelReason
        : undefined,
  };
}
