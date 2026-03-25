/**
 * Phone number formatting utilities.
 */

/**
 * Format a 10-digit string as a US phone number.
 *
 * @param digits - A string containing exactly 10 numeric characters.
 * @returns The formatted phone number in `(XXX) XXX-XXXX` format.
 * @throws {Error} If the input does not contain exactly 10 digits.
 *
 * @example
 * ```ts
 * formatPhoneNumber("5551234567"); // "(555) 123-4567"
 * ```
 */
export function formatPhoneNumber(digits: string): string {
  if (!/^\d{10}$/.test(digits)) {
    throw new Error(
      `Expected exactly 10 digits, received "${digits}".`,
    );
  }

  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);

  return `(${area}) ${prefix}-${line}`;
}
