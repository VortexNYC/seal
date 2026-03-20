import { createRequire } from "node:module";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

import * as SourceConfig from "./source.config";
import { searchIndexPlugin } from "./src/plugins/search-index";

const require = createRequire(import.meta.url);

export default defineConfig(async ({ command }) => ({
  server: {
    port: 3001,
    proxy: {
      "/ingest/static": {
        target: "https://us-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (pathStr: string) => pathStr.replace(/^\/ingest\/static/, "/static"),
      },
      "/ingest": {
        target: "https://us.i.posthog.com",
        changeOrigin: true,
        rewrite: (pathStr: string) => pathStr.replace(/^\/ingest/, ""),
      },
    },
  },
  plugins: [
    // Polyfill node:path → path-browserify in client builds only.
    // fumadocs-core/source and fumadocs-mdx/runtime/server call path.join at
    // module init, crashing the browser where node:path is externalized to undefined.
    {
      name: "polyfill-node-path-client",
      enforce: "pre" as const,
      resolveId(source: string, _importer: string | undefined, options: { ssr?: boolean }) {
        if (source === "node:path" && !options.ssr) {
          return require.resolve("path-browserify");
        }
      },
    },
    await mdx(SourceConfig, { updateViteConfig: false }),
    searchIndexPlugin(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    // Nitro handles Vercel deployment (serverless functions, Build Output API).
    // Only included during build — breaks standalone Vite servers used by tools.
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],

  resolve: {
    noExternal: ["fumadocs-core", "fumadocs-ui", "fumadocs-openapi", "@fumadocs/base-ui"],
    dedupe: ["fumadocs-core", "fumadocs-ui", "fumadocs-openapi", "@fumadocs/base-ui"],
    tsconfigPaths: true,
    alias: {
      "fumadocs-mdx:collections/server": path.resolve(import.meta.dirname, "./.source/server.ts"),
      "fumadocs-mdx:collections/browser": path.resolve(import.meta.dirname, "./.source/browser.ts"),
      "fumadocs-mdx:collections/dynamic": path.resolve(import.meta.dirname, "./.source/dynamic.ts"),
    },
  },

  // Polyfill node:path → path-browserify only during browser dep pre-bundling.
  // fumadocs-core/source uses path.join/dirname which don't exist in browsers.
  optimizeDeps: {
    rolldownOptions: {
      plugins: [
        {
          name: "polyfill-node-path",
          resolveId(source: string) {
            if (source === "node:path") {
              return require.resolve("path-browserify");
            }
          },
        },
      ],
    },
  },
}));
