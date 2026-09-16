/// <reference types="@cloudflare/workers-types" />

export interface Env {
  ASSETS: Fetcher;
}

const FORBIDDEN_HEADERS = new Set([
  "cookie",
  "authorization",
  "host",
  "x-internal-api-key",
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/ingest/")) {
      const isStatic = url.pathname.startsWith("/ingest/static/");
      const targetHost = isStatic
        ? "https://us-assets.i.posthog.com"
        : "https://us.i.posthog.com";
      const targetPath = isStatic
        ? url.pathname.slice("/ingest/static".length)
        : url.pathname.slice("/ingest".length);

      const targetUrl = new URL(targetPath + url.search, targetHost);
      const headers = new Headers();

      for (const [name, value] of request.headers) {
        if (FORBIDDEN_HEADERS.has(name.toLowerCase())) {
          continue;
        }
        headers.append(name, value);
      }

      headers.set("Origin", "https://app.seal.nyc");
      headers.set("Referer", "https://app.seal.nyc/");

      return fetch(
        new Request(targetUrl, {
          method: request.method,
          headers,
          body: request.body,
        })
      );
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
