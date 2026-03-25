/**
 * Capitalizes the first letter of a string.
 *
 * @param str - The input string to capitalize.
 * @returns The input string with its first letter converted to uppercase.
 *
 * @example
 * ```ts
 * capitalize("hello"); // "Hello"
 * ```
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
