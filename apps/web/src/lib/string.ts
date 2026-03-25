/**
 * String utility functions for text transformation and manipulation.
 */

/**
 * Capitalize the first character of a string.
 *
 * Returns the input string with its first character converted to uppercase
 * and the remainder of the string unchanged. Returns an empty string if
 * the input is empty.
 *
 * @param value - The string to capitalize
 * @returns The string with its first character capitalized
 *
 * @example
 * capitalize("hello") // "Hello"
 * capitalize("already Capitalized") // "Already Capitalized"
 * capitalize("") // ""
 */
export function capitalize(value: string): string {
  if (value.length === 0) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
