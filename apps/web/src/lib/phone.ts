/**
 * Phone number formatting utilities.
 */

/**
 * Formats a 10-digit phone number string into the standard US format.
 *
 * @param phone - A 10-digit numeric string (e.g., "5551234567")
 * @returns The formatted phone number in (XXX) XXX-XXXX format (e.g., "(555) 123-4567")
 * @throws {Error} If the input is not a 10-digit numeric string
 *
 * @example
 * ```ts
 * formatPhoneNumber("5551234567"); // "(555) 123-4567"
 * ```
 */
export function formatPhoneNumber(phone: string): string {
  if (!/^\d{10}$/.test(phone)) {
    throw new Error(
      `Expected a 10-digit numeric string, received: "${phone}"`,
    );
  }

  const area = phone.slice(0, 3);
  const prefix = phone.slice(3, 6);
  const line = phone.slice(6, 10);

  return `(${area}) ${prefix}-${line}`;
}
