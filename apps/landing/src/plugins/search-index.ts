import type { Plugin, ViteDevServer } from "vite";

const SEARCH_INDEX_ROUTE = "/api/search.json";

/**
 * Vite plugin that serves the Fumadocs search index in dev mode.
 *
 * During dev: uses ssrLoadModule with node:path override to generate
 * the search index server-side while the browser uses path-browserify.
 * Production builds rely on a pre-generated static JSON file.
 */
export function searchIndexPlugin(): Plugin {
  return {
    name: "fumadocs-search-index",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(SEARCH_INDEX_ROUTE, async (_req, res) => {
        try {
          const { searchAPI } =
            await server.ssrLoadModule("/src/lib/source.ts");
          const response = await searchAPI.staticGET();
          const data = await response.json();

          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-cache");
          res.end(JSON.stringify(data));
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("[search-index] Failed to generate index:", errMsg);
          res.statusCode = 500;
          // Return a valid empty index so the client doesn't crash
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([]));
        }
      });
    },
  };
}
