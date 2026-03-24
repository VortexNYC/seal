/**
 * Text manipulation utility functions.
 */

/**
 * Truncate text to a maximum length, appending '...' if the text exceeds the limit.
 *
 * If the text length is less than or equal to `maxLength`, the original text is
 * returned unchanged. Otherwise, the text is trimmed to `maxLength - 3` characters
 * and '...' is appended.
 *
 * @param text - The input string to truncate.
 * @param maxLength - The maximum allowed length of the returned string, including the ellipsis.
 * @returns The original text if within the limit, or the truncated text with '...' appended.
 *
 * @example
 * ```ts
 * truncateText("Hello, world!", 10); // "Hello, ..."
 * truncateText("Short", 10);         // "Short"
 * ```
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + "...";
}
