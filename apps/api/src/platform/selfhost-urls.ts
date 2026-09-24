/**
 * Detect bare selfhost workers.dev placeholders that omit the account subdomain.
 * e.g. seal-selfhost-web.workers.dev (broken) vs seal-selfhost-web.shlomo-31b.workers.dev (ok).
 */
export function isPlaceholderSelfhostUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return /^(seal-selfhost-(?:api|web)|seal-(?:api|web))\.workers\.dev$/.test(
      host
    );
  } catch {
    return false;
  }
}

export function selfhostUrlConfigError(
  env: { APP_URL?: string; BETTER_AUTH_URL?: string }
): string | null {
  if (isPlaceholderSelfhostUrl(env.APP_URL)) {
    return `APP_URL is a bare workers.dev placeholder (${env.APP_URL}). Redeploy via pnpm selfhost or: wrangler deploy --env selfhost --var APP_URL:https://seal-selfhost-web.<account>.workers.dev --var BETTER_AUTH_URL:https://seal-selfhost-api.<account>.workers.dev --var ALLOWED_ORIGINS:https://seal-selfhost-web.<account>.workers.dev`;
  }
  if (isPlaceholderSelfhostUrl(env.BETTER_AUTH_URL)) {
    return `BETTER_AUTH_URL is a bare workers.dev placeholder (${env.BETTER_AUTH_URL}). Redeploy via pnpm selfhost so account-scoped URLs are set.`;
  }
  return null;
}
