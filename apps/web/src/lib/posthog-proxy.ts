/**
 * Rewrite app `/ingest` paths to PostHog upstream URLs.
 * Must match apps/web/vite.config.ts proxy rewrites.
 */
export function rewritePosthogIngestPath(pathname: string): {
  targetHost: string;
  targetPath: string;
} {
  if (pathname.startsWith("/ingest/static/")) {
    return {
      targetHost: "https://us-assets.i.posthog.com",
      // PostHog serves recorder/survey assets under /static/…
      targetPath: pathname.replace(/^\/ingest\/static/, "/static"),
    };
  }
  if (pathname.startsWith("/ingest/")) {
    return {
      targetHost: "https://us.i.posthog.com",
      targetPath: pathname.replace(/^\/ingest/, "") || "/",
    };
  }
  throw new Error(`Not a PostHog ingest path: ${pathname}`);
}

/** Guest signing/verify surfaces — no capture, recording, or surveys (SEA-73). */
export function isGuestAnalyticsSurface(pathname: string): boolean {
  return (
    pathname.startsWith("/sign/") ||
    pathname.startsWith("/verify/") ||
    pathname === "/sign" ||
    pathname === "/verify"
  );
}
