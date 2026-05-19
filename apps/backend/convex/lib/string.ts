/**
 * String utility functions for the Seal backend.
 */

/**
 * Truncate a string from the middle, replacing the removed portion with an
 * ellipsis (`…`) so that the returned string is exactly `max` characters long.
 *
 * - If `s.length <= max`, returns `s` unchanged.
 * - Otherwise keeps a prefix and suffix of `s`, favoring the prefix when the
 *   amount removed is odd.
 *
 * @param s   The source string.
 * @param max The desired maximum length of the result.
 * @returns   The truncated string.
 */
export function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  if (max <= 0) {
    return "";
  }
  if (max === 1) {
    return "…";
  }

  const keep = max - 1;
  const prefixLen = Math.ceil(keep / 2);
  const suffixLen = Math.floor(keep / 2);

  return s.slice(0, prefixLen) + "…" + s.slice(s.length - suffixLen);
}
