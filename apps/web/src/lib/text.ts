/**
 * Text manipulation utility functions for truncation and display formatting.
 */

/**
 * Truncate a text string to a maximum length, appending an ellipsis ('...') if
 * the text exceeds the limit.
 *
 * Returns the original text unchanged when its length is within `maxLength`.
 * When truncation is required, the returned string is exactly `maxLength`
 * characters long, consisting of the leading portion of the text followed by
 * '...'.
 *
 * Edge cases:
 * - If `maxLength` is less than 3, returns '...' truncated to `maxLength`
 *   (i.e. the first `maxLength` characters of '...').
 * - Empty strings are returned as-is when `maxLength` >= 0.
 *
 * @param text - The source string to truncate.
 * @param maxLength - The maximum allowed length of the returned string.
 * @returns The original text if within the limit, or a truncated string with
 *   '...' appended.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength < 3) {
    return "...".slice(0, maxLength);
  }

  return text.slice(0, maxLength - 3) + "...";
}
