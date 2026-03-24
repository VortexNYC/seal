/**
 * Phone number formatting utility functions.
 */

/**
 * Format a 10-digit phone number string into a human-readable format.
 *
 * Accepts a string of exactly 10 digits and returns a formatted phone number
 * in the standard US format: `(XXX) XXX-XXXX`.
 *
 * @param phoneString - A string containing exactly 10 digit characters.
 * @returns The formatted phone number string in `(XXX) XXX-XXXX` format.
 * @throws {Error} If the input is not a string of exactly 10 digits.
 *
 * @example
 * ```ts
 * formatPhoneNumber("1234567890");
 * // => "(123) 456-7890"
 *
 * formatPhoneNumber("5551234567");
 * // => "(555) 123-4567"
 * ```
 */
export function formatPhoneNumber(phoneString: string): string {
  if (!/^\d{10}$/.test(phoneString)) {
    throw new Error(
      `Invalid phone number: expected a 10-digit string, received "${phoneString}"`,
    );
  }

  const area = phoneString.slice(0, 3);
  const prefix = phoneString.slice(3, 6);
  const line = phoneString.slice(6, 10);

  return `(${area}) ${prefix}-${line}`;
}
