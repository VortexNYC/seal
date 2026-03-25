/**
 * Phone number formatting utility functions.
 */

/**
 * Format a 10-digit phone number string into (XXX) XXX-XXXX format.
 *
 * Accepts only strings containing exactly 10 digit characters with no other
 * characters. Throws an error for invalid inputs.
 *
 * @param phoneString - A string of exactly 10 digits (e.g., "5551234567")
 * @returns The formatted phone number string (e.g., "(555) 123-4567")
 *
 * @example
 * ```ts
 * formatPhoneNumber("5551234567");
 * // => "(555) 123-4567"
 *
 * formatPhoneNumber("0000000000");
 * // => "(000) 000-0000"
 * ```
 *
 * @throws {Error} If the input is not exactly 10 digits
 */
export function formatPhoneNumber(phoneString: string): string {
  if (!/^\d{10}$/.test(phoneString)) {
    throw new Error(
      `Invalid phone number: expected exactly 10 digits, received "${phoneString}"`,
    );
  }

  const area = phoneString.slice(0, 3);
  const prefix = phoneString.slice(3, 6);
  const line = phoneString.slice(6, 10);

  return `(${area}) ${prefix}-${line}`;
}
