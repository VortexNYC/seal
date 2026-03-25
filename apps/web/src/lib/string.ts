/** String utility functions. */

/**
 * Capitalize the first character of a string.
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str[0].toUpperCase() + str.slice(1);
}
