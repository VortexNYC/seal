/**
 * Shared utility functions for Seal backend.
 */

/**
 * Convert a string into a URL-friendly slug.
 *
 * - Lowercases the input
 * - Replaces non-alphanumeric characters with hyphens
 * - Collapses consecutive hyphens
 * - Strips leading/trailing hyphens
 * - Falls back to `"item-<timestamp>"` when the result would be empty
 *
 * @example
 *   slugify("Acme Corp!")   // "acme-corp"
 *   slugify("  Hello World  ") // "hello-world"
 *   slugify("!!!") // "item-1711152000000"
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `item-${Date.now()}`;
}
