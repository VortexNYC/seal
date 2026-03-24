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

/**
 * Truncates a string to a maximum length, appending "..." if truncated.
 *
 * @param str - The input string to truncate.
 * @param maxLength - The maximum allowed length of the returned string (including "...").
 * @returns The original string if within maxLength, otherwise the string truncated with "..." appended.
 *
 * @example
 * ```ts
 * truncate("Hello, world!", 5); // "He..."
 * truncate("Hi", 10); // "Hi"
 * truncate("", 5); // ""
 * ```
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
