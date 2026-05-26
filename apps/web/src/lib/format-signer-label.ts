/**
 * Format a signer label as 'name (email)' when a name is provided,
 * otherwise return just the email.
 */
export function formatSignerLabel(
  name: string | null | undefined,
  email: string,
): string {
  if (name) {
    return `${name} (${email})`;
  }
  return email;
}
