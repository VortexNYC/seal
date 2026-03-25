/**
 * String utility functions for text transformation and formatting.
 */

/**
 * Capitalizes the first character of a string, leaving the rest unchanged.
 *
 * @param value - The string to capitalize.
 * @returns The input string with its first character converted to uppercase.
 *
 * @example
 * ```ts
 * capitalize("hello")    // "Hello"
 * capitalize("hello world") // "Hello world"
 * capitalize("")         // ""
 * ```
 */
export function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
