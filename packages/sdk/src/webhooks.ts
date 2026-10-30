/**
 * Verify inbound Seal webhook deliveries (HMAC-SHA256 over the raw JSON body).
 * Matches `deliverToWebhook` in apps/api/src/platform/webhook-events.ts.
 */

export interface SealWebhookEnvelope {
  eventId: string;
  eventType: string;
  timestamp: string;
  payloadMode?: string;
  data: Record<string, unknown>;
}

export interface SealWebhookRequestHeaders {
  /** `X-Seal-Signature` — `sha256=<hex>` */
  signature: string | null | undefined;
  /** `X-Seal-Event` — event type string */
  event: string | null | undefined;
  /** `X-Seal-Delivery-Id` */
  deliveryId: string | null | undefined;
}

const SIGNATURE_PREFIX = "sha256=";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * @returns false when header is missing or malformed
 */
export async function verifySealWebhookSignature(
  rawPayload: string,
  signatureHeader: string | null | undefined,
  secret: string
): Promise<boolean> {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const digest = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(digest)) {
    return false;
  }
  const expected = await hmacSha256Hex(secret, rawPayload);
  return timingSafeEqualHex(digest.toLowerCase(), expected.toLowerCase());
}

export function parseSealWebhookEnvelope(rawPayload: string): SealWebhookEnvelope {
  const parsed: unknown = JSON.parse(rawPayload);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid webhook JSON");
  }
  const record = parsed as Record<string, unknown>;
  const eventId = record.eventId;
  const eventType = record.eventType;
  const timestamp = record.timestamp;
  const data = record.data;
  if (typeof eventId !== "string" || typeof eventType !== "string") {
    throw new Error("Missing eventId or eventType");
  }
  if (typeof timestamp !== "string") {
    throw new Error("Missing timestamp");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Missing data object");
  }
  const payloadMode =
    typeof record.payloadMode === "string" ? record.payloadMode : undefined;
  return {
    eventId,
    eventType,
    timestamp,
    payloadMode,
    data: data as Record<string, unknown>,
  };
}

export function readSealWebhookHeaders(
  headers: Headers | Record<string, string | undefined>
): SealWebhookRequestHeaders {
  const get = (name: string): string | null | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) {
        return value;
      }
    }
    return undefined;
  };
  return {
    signature: get("X-Seal-Signature"),
    event: get("X-Seal-Event"),
    deliveryId: get("X-Seal-Delivery-Id"),
  };
}
