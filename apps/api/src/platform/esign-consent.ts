/**
 * ESIGN / UETA demonstrable consent (SEA-45 / CompAI fnd_6ab563f55921f68ef33f6b75).
 * Server owns the consent text that was shown and hashes it for the audit record.
 */

export const DEFAULT_ESIGN_CONSENT_TEXT = [
  "By checking the box below, you consent to use electronic signatures for this document and future documents.",
  "You acknowledge that:",
  "Electronic signatures have the same legal effect as handwritten signatures under the ESIGN Act.",
  "You can request paper copies at any time.",
  "You can withdraw consent by contacting us.",
  "Technical requirements: a modern web browser with JavaScript enabled, and email access to receive signed documents.",
].join("\n");

export const ESIGN_CONSENT_VERSION = "seal-esign-1";

export function resolveEsignConsentText(
  customText: string | null | undefined
): string {
  const trimmed = typeof customText === "string" ? customText.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_ESIGN_CONSENT_TEXT;
}

export async function hashEsignConsentText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function readOrgEsignConsentText(
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
    const text = (signing as Record<string, unknown>).esignConsentText;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}
