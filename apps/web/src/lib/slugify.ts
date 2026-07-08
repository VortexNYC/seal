/**
 * Convert a string into a URL-friendly slug.
 *
 * - Lower-cases the input
 * - Replaces non-alphanumeric characters with hyphens
 * - Collapses consecutive hyphens
 * - Trims leading and trailing hyphens
 *
 * @param input - The string to slugify
 * @returns A URL-safe slug string
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
