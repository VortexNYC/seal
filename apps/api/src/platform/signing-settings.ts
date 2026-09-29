/**
 * Org signing compliance defaults.
 * Secure-by-default: recipient auth + signer account unless an admin opts out.
 */

import {
  normalizeAuthMethod,
  type SignerAuthMethod,
} from "./signer-auth.js";

export type OrgSigningCompliance = {
  requireRecipientAuth: boolean;
  requireSignerAccount: boolean;
  defaultRecipientAuthMethod: Exclude<SignerAuthMethod, "none">;
};

const DEFAULT_COMPLIANCE: OrgSigningCompliance = {
  requireRecipientAuth: true,
  requireSignerAccount: true,
  defaultRecipientAuthMethod: "email_otp",
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function readOrgSigningCompliance(
  organizationMetadata: string | null | undefined
): OrgSigningCompliance {
  if (!organizationMetadata) {
    return { ...DEFAULT_COMPLIANCE };
  }
  try {
    const parsed: unknown = JSON.parse(organizationMetadata);
    const signing = asRecord(asRecord(parsed).signingSettings);

    const requireRecipientAuth =
      typeof signing.requireRecipientAuth === "boolean"
        ? signing.requireRecipientAuth
        : DEFAULT_COMPLIANCE.requireRecipientAuth;

    const requireSignerAccount =
      typeof signing.requireSignerAccount === "boolean"
        ? signing.requireSignerAccount
        : DEFAULT_COMPLIANCE.requireSignerAccount;

    const rawDefault = signing.defaultRecipientAuthMethod;
    const normalized = normalizeAuthMethod(
      typeof rawDefault === "string" ? rawDefault : undefined
    );
    const defaultRecipientAuthMethod: Exclude<SignerAuthMethod, "none"> =
      normalized === "access_code" ? "access_code" : "email_otp";

    return {
      requireRecipientAuth,
      requireSignerAccount,
      defaultRecipientAuthMethod,
    };
  } catch {
    return { ...DEFAULT_COMPLIANCE };
  }
}

/** When authMethod is omitted on create, use the org default (never `none`). */
export function resolveRecipientAuthMethod(
  value: string | null | undefined,
  organizationMetadata?: string | null
): SignerAuthMethod {
  if (value === "none" || value === "access_code" || value === "email_otp") {
    return value;
  }
  return readOrgSigningCompliance(organizationMetadata)
    .defaultRecipientAuthMethod;
}
