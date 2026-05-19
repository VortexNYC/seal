/**
 * Capitalizes each word in a string (title case).
 * Words are separated by whitespace.
 */
export function titleCase(s: string): string {
  if (!s) return s;
  return s
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Creates a lowercase ASCII slug with hyphens, stripping non-alphanumeric characters.
 */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      // replace any sequence of non-alphanumeric characters with a single hyphen
      .replace(/[^a-z0-9]+/g, "-")
      // remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Truncates a string to a maximum length, appending an optional suffix.
 * If the string is already within the limit, it is returned unchanged.
 */
export function ellipsize(s: string, max: number, suffix = "…"): string {
  if (s.length <= max) return s;
  if (max <= 0) return "";
  const truncateTo = Math.max(0, max - suffix.length);
  return s.slice(0, truncateTo) + suffix;
}
