/**
 * Redaction utilities for PDF exports
 *
 * Masks sensitive data (emails and phone numbers) based on the
 * document's redactionLevel setting.
 */

export type RedactionLevel = "none" | "standard" | "strict";

/**
 * Mask an email address, keeping only the first character of the local part
 * and the TLD visible.
 *
 * Example: "alice@example.com" → "a***@***.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) {
    return email;
  }

  const [localPart, domain] = email.split("@");
  if (!domain || !localPart) {
    return email;
  }

  const firstChar = localPart.charAt(0);

  // Extract TLD (everything after the last dot)
  const lastDotIndex = domain.lastIndexOf(".");
  const tld = lastDotIndex >= 0 ? domain.slice(lastDotIndex) : "";

  return `${firstChar}***@***${tld}`;
}

/**
 * Mask a phone number, keeping only the last 4 digits visible.
 *
 * Example: "+1-555-123-4567" → "***-***-4567"
 */
export function maskPhone(phone: string): string {
  if (!phone) {
    return phone;
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) {
    return "***-***-****";
  }

  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Apply redaction to a text value based on the redaction level.
 *
 * @param value - The raw text (email or phone)
 * @param type  - Whether the value is an "email" or "phone"
 * @param level - The document's redactionLevel
 * @returns The potentially masked value
 */
export function applyRedaction(
  value: string | null | undefined,
  type: "email" | "phone",
  level: RedactionLevel | undefined,
): string | null | undefined {
  if (!value || level === "none" || level === undefined || level === null) {
    return value;
  }

  if (type === "email") {
    if (level === "strict") {
      return maskEmail(value);
    }
    return value;
  }

  if (type === "phone") {
    if (level === "strict" || level === "standard") {
      return maskPhone(value);
    }
    return value;
  }

  return value;
}
