/**
 * Graded signer authentication (SEA-48).
 * Binds the human act when an agent (or anyone) holds the signing URL.
 *
 * Tiers shipped: none | access_code | email_otp
 * SMS OTP deferred until a provider is wired.
 */

import { z } from "zod";

import { hashToken } from "./api-token-auth.js";

export const SIGNER_AUTH_METHODS = ["none", "access_code", "email_otp"] as const;
export type SignerAuthMethod = (typeof SIGNER_AUTH_METHODS)[number];

export const signerAuthMethodSchema = z.enum(SIGNER_AUTH_METHODS);

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_LENGTH = 6;

const challengeSchema = z.object({
  codeHash: z.string(),
  expiresAt: z.number(),
  attempts: z.number().int().nonnegative(),
});

const authStateSchema = z.object({
  challenge: challengeSchema.optional(),
  verifiedAt: z.number().optional(),
  verifiedMethod: signerAuthMethodSchema.optional(),
});

export type SignerAuthState = z.infer<typeof authStateSchema>;

export function parseSignerAuthState(
  raw: string | null | undefined
): SignerAuthState {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = authStateSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function serializeSignerAuthState(state: SignerAuthState): string {
  return JSON.stringify(state);
}

export function normalizeAuthMethod(
  value: string | null | undefined
): SignerAuthMethod {
  if (value === "access_code" || value === "email_otp") {
    return value;
  }
  return "none";
}

export function isSignerAuthVerified(
  authMethod: string | null | undefined,
  authenticationData: string | null | undefined
): boolean {
  const method = normalizeAuthMethod(authMethod);
  if (method === "none") {
    return true;
  }
  const state = parseSignerAuthState(authenticationData);
  return (
    typeof state.verifiedAt === "number" && state.verifiedMethod === method
  );
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "***";
  }
  const visible = local.slice(0, Math.min(1, local.length));
  return `${visible}****@${domain}`;
}

export async function hashAccessCode(code: string): Promise<string> {
  return hashToken(code.trim().toLowerCase());
}

export async function verifyAccessCode(
  code: string,
  accessCodeHash: string | null | undefined
): Promise<boolean> {
  if (!accessCodeHash) {
    return false;
  }
  const hash = await hashAccessCode(code);
  return timingSafeEqualHex(hash, accessCodeHash);
}

export function generateEmailOtpCode(): string {
  const bytes = new Uint8Array(OTP_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += String(byte % 10);
  }
  return code;
}

export async function startEmailOtpChallenge(
  existing: SignerAuthState
): Promise<{ state: SignerAuthState; code: string }> {
  const code = generateEmailOtpCode();
  const codeHash = await hashToken(code);
  return {
    code,
    state: {
      challenge: {
        codeHash,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
      },
    },
  };
}

export type OtpVerifyResult =
  | { ok: true; state: SignerAuthState }
  | {
      ok: false;
      reason: "expired" | "invalid" | "locked" | "missing";
      state: SignerAuthState;
    };

export function bumpOtpAttempts(existing: SignerAuthState): SignerAuthState {
  if (!existing.challenge) {
    return existing;
  }
  return {
    ...existing,
    challenge: {
      ...existing.challenge,
      attempts: existing.challenge.attempts + 1,
    },
  };
}

export async function verifyEmailOtpChallenge(
  existing: SignerAuthState,
  code: string
): Promise<OtpVerifyResult> {
  const challenge = existing.challenge;
  if (!challenge) {
    return { ok: false, reason: "missing", state: existing };
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "locked", state: existing };
  }
  if (challenge.expiresAt < Date.now()) {
    return { ok: false, reason: "expired", state: existing };
  }

  const hash = await hashToken(code.trim());
  if (!timingSafeEqualHex(hash, challenge.codeHash)) {
    const state = bumpOtpAttempts(existing);
    const locked = (state.challenge?.attempts ?? 0) >= OTP_MAX_ATTEMPTS;
    return {
      ok: false,
      reason: locked ? "locked" : "invalid",
      state,
    };
  }

  return {
    ok: true,
    state: {
      verifiedAt: Date.now(),
      verifiedMethod: "email_otp",
    },
  };
}

export function markAccessCodeVerified(): SignerAuthState {
  return {
    verifiedAt: Date.now(),
    verifiedMethod: "access_code",
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
