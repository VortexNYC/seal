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

const defaultToleranceSeconds = 5 * 60;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
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

function parseSignatureHeader(header: string | null | undefined): {
  readonly timestamp: number;
  readonly signatures: readonly string[];
} | null {
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
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function createVortexWebhookSignature(
  input: CreateVortexWebhookSignatureInput
): Promise<{
  readonly header: string;
  readonly timestamp: number;
  readonly signature: string;
}> {
  const timestamp = input.timestamp ?? Date.now();
  const signature = await hmacSha256Hex(
    input.secret,
    `${timestamp}.${input.payload}`
  );
  return {
    header: `t=${timestamp},v1=${signature}`,
    timestamp,
    signature,
  };
}

export async function verifyVortexWebhookSignature(
  input: VerifyVortexWebhookSignatureInput
): Promise<VortexWebhookSignatureVerificationResult> {
  const parsed = parseSignatureHeader(input.header);
  if (
    input.header === null ||
    input.header === undefined ||
    input.header.length === 0
  ) {
    return { ok: false, reason: "missing_header" };
  }
  if (!parsed) {
    return { ok: false, reason: "invalid_header" };
  }

  const toleranceMs =
    (input.toleranceSeconds ?? defaultToleranceSeconds) * 1000;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(toleranceMs) || toleranceMs < 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  if (Math.abs(now - parsed.timestamp) > toleranceMs) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  const expected = await hmacSha256Hex(
    input.secret,
    `${parsed.timestamp}.${input.payload}`
  );
  const expectedBytes = hexToBytes(expected);
  if (!expectedBytes) {
    return { ok: false, reason: "invalid_signature" };
  }

  for (const signature of parsed.signatures) {
    const actualBytes = hexToBytes(signature);
    if (actualBytes && constantTimeEqual(expectedBytes, actualBytes)) {
      return { ok: true, timestamp: parsed.timestamp, signature };
    }
  }

  return { ok: false, reason: "invalid_signature" };
}
