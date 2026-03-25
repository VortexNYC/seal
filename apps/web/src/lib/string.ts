/**
 * String utility functions for text transformation and manipulation.
 */

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str[0].toUpperCase() + str.slice(1);
}
