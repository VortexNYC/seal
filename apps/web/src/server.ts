/// <reference types="@cloudflare/workers-types" />

export interface Env {
  ASSETS: Fetcher;
}

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

      return fetch(
        new Request(new URL(targetPath + url.search, targetHost), {
          method: request.method,
          headers: request.headers,
          body: request.body,
        })
      );
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
