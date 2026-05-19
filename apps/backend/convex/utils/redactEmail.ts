/**
 * Redacts the local-part of an email address for safe logging.
 *
 * Keeps the first and last character of the local-part, replaces the
 * middle with asterisks, and preserves the full domain.
 *
 * Examples:
 * - 'john.doe@example.com' -> 'j******e@example.com'
 * - 'ab@x.io' -> 'a*b@x.io'
 * - 'a@x.io' -> 'a@x.io'
 * - No '@' -> unchanged
 */
export function redactEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return email;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (local.length <= 1) {
    return email;
  }

  const redactedLocal =
    local[0] + "*".repeat(Math.max(1, local.length - 2)) + local[local.length - 1];

  return `${redactedLocal}@${domain}`;
}
