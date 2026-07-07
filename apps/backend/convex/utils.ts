/**
 * Convert text to a URL-friendly slug.
 *
 * Rules:
 *  - Lowercase
 *  - Trim leading/trailing whitespace
 *  - Collapse runs of whitespace to a single hyphen
 *  - Strip any character that is not a-z, 0-9, or hyphen
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
