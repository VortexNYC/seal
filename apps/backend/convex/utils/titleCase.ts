/**
 * Convert a string to title case.
 *
 * Each word separated by whitespace is capitalized; characters after the
 * first letter of each word are lowercased. Non-alphabetic characters
 * (punctuation, hyphens, etc.) are preserved.
 */
export function titleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
