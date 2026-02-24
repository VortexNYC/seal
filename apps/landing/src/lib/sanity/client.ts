import { createClient } from "@sanity/client";

import { sanityConfig } from "./env";

export const sanityClient = createClient({
  projectId: sanityConfig.projectId,
  dataset: sanityConfig.dataset,
  apiVersion: sanityConfig.apiVersion,
  useCdn: sanityConfig.useCdn,
});

// Lightweight server-side Sanity client using native fetch.
// The @sanity/client uses get-it (Node.js http/https modules) which hangs
// in Nitro's production bundled environment. This bypasses that entirely.
export const sanityServerClient = {
  async fetch<T>(query: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(
      `/v${sanityConfig.apiVersion}/data/query/${sanityConfig.dataset}`,
      `https://${sanityConfig.projectId}.api.sanity.io`,
    );
    url.searchParams.set("query", query);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(`$${key}`, JSON.stringify(value));
      }
    }

    const res = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Sanity query failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { result: T };
    return data.result;
  },
};
