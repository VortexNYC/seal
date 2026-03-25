/**
 * String utility functions for common text transformations.
 */

/**
 * Capitalizes the first letter of a string, leaving the rest unchanged.
 *
 * @param str - The input string to capitalize.
 * @returns The string with its first letter capitalized, or an empty string
 *   if the input is empty.
 */
export function capitalize(str: string): string {
  if (str.length === 0) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
