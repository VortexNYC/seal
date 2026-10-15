/** A signer pay link is a Vortex hosted URL. Anything else stays off the ceremony. */
export function payNowHref(url: string | null | undefined): string | null {
  if (!url?.startsWith("https://")) return null;
  return url;
}
