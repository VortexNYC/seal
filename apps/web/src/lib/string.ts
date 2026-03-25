/**
 * String utility functions for text transformation and display.
 */

/**
 * Capitalize the first letter of a string and lowercase the rest.
 *
 * @example capitalize("hello") // "Hello"
 * @example capitalize("HELLO") // "Hello"
 * @example capitalize("") // ""
 */
export function capitalize(value: string): string {
  if (value.length === 0) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
