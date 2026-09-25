/**
 * Signer privacy notice + CCPA disclosures (SEA-52).
 * CompAI fnd_6ab57d53cb550d31b62425d7 + fnd_6ab57d541b22e8a67eda3def.
 * Server owns the notice text shown and hashes it for the audit record.
 */

export const DEFAULT_PRIVACY_NOTICE_TEXT = [
  "Privacy notice for electronic signing",
  "",
  "Seal and the document sender process personal information to deliver this signing ceremony and produce an evidentiary record.",
  "",
  "Categories collected may include: name, email address, IP address, device/browser information, signature image or typed name, timestamps, and document interaction events.",
  "",
  "Purposes: authenticate you as a signer, complete the transaction, maintain audit and certificate-of-completion records, prevent fraud, and meet legal/compliance obligations.",
  "",
  "California (CCPA/CPRA): You have the right to know what personal information is collected, to request deletion (subject to legal retention for signed records), to correct inaccurate information, and to non-discrimination for exercising these rights. We do not sell personal information. We do not share personal information for cross-context behavioral advertising in connection with signing.",
  "",
  "Retention: Signing evidence is retained for the period required by the sender’s retention policy and applicable law.",
  "",
  "By checking the box below, you acknowledge that you have read this privacy notice.",
].join("\n");

export const PRIVACY_NOTICE_VERSION = "seal-privacy-1";

export function resolvePrivacyNoticeText(
  customText: string | null | undefined
): string {
  const trimmed = typeof customText === "string" ? customText.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_PRIVACY_NOTICE_TEXT;
}

export async function hashPrivacyNoticeText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function readOrgPrivacyNoticeText(
  organizationMetadata: string | null | undefined
): string | null {
  if (!organizationMetadata) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(organizationMetadata);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const signing = record.signingSettings;
    if (
      typeof signing !== "object" ||
      signing === null ||
      Array.isArray(signing)
    ) {
      return null;
    }
    const text = (signing as Record<string, unknown>).privacyNoticeText;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}
