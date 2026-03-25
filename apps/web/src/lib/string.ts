/**
 * String utility functions for common text transformations.
 */

/**
 * Capitalize the first character of a string, lowercasing the rest.
 *
 * @param value - The string to capitalize.
 * @returns The capitalized string, or an empty string if the input is empty.
 * @example
 * capitalize("hello") // "Hello"
 * capitalize("HELLO") // "Hello"
 * capitalize("")      // ""
 */
export function capitalize(value: string): string {
  if (value.length === 0) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
