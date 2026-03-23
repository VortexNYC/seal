/**
 * Shared utility functions for the Seal backend.
 */

/**
 * Convert a string into a URL-friendly slug.
 *
 * - Lowercases the input
 * - Replaces any run of non-alphanumeric characters with a single hyphen
 * - Strips leading/trailing hyphens
 * - Falls back to `"item-<timestamp>"` when the result would be empty
 *   (e.g. input is entirely non-latin characters or symbols)
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Return non-empty slug or fallback
  return slug || `item-${Date.now()}`;
}
