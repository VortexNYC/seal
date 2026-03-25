/**
 * Capitalizes the first letter of a string, leaving the rest unchanged.
 *
 * @param str - The input string to capitalize.
 * @returns The string with its first letter converted to uppercase.
 *
 * @example
 * capitalize('hello')  // 'Hello'
 * capitalize('Hello')  // 'Hello'
 * capitalize('HELLO')  // 'HELLO'
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
