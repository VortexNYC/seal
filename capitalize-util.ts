/**
 * Capitalizes the first letter of a string.
 *
 * @param str - The input string to capitalize.
 * @returns The input string with its first letter converted to uppercase.
 *
 * @example
 * ```ts
 * capitalize("hello"); // "Hello"
 * capitalize(""); // ""
 * ```
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
