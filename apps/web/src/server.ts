/// <reference types="@cloudflare/workers-types" />

import { rewritePosthogIngestPath } from "./lib/posthog-proxy";

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
      const { targetHost, targetPath } = rewritePosthogIngestPath(url.pathname);
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
