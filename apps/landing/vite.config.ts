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

function matchesPackage(id: string, pkg: string): boolean {
  return id.includes(`/node_modules/${pkg}/`) || id.endsWith(`/node_modules/${pkg}`);
}

function getManualChunkName(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  // Never reassign CSS files — Rolldown's CSS module codegen breaks when CSS
  // imports are forced into a different chunk (generates `style_exports` before
  // the variable is declared).
  if (id.endsWith(".css")) {
    return undefined;
  }

  if (
    matchesPackage(id, "fumadocs-core") ||
    matchesPackage(id, "fumadocs-mdx") ||
    matchesPackage(id, "fumadocs-openapi") ||
    matchesPackage(id, "fumadocs-ui") ||
    id.includes("/node_modules/shiki/") ||
    id.includes("/node_modules/refractor/")
  ) {
    return "vendor-docs";
  }

  if (matchesPackage(id, "@scalar") || matchesPackage(id, "scalar")) {
    return "vendor-api-ref";
  }

  if (matchesPackage(id, "motion") || matchesPackage(id, "framer-motion")) {
    return "vendor-motion";
  }

  if (matchesPackage(id, "@clerk") || matchesPackage(id, "posthog")) {
    return "vendor-services";
  }

  return undefined;
}

export default defineConfig(async ({ command }) => ({
  server: {
    port: 5181,
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
    await mdx(SourceConfig, { updateViteConfig: true }),
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
    tsconfigPaths: true,
    alias: {
      "fumadocs-mdx:collections/server": path.resolve(import.meta.dirname, "./.source/server.ts"),
      "fumadocs-mdx:collections/browser": path.resolve(import.meta.dirname, "./.source/browser.ts"),
      "fumadocs-mdx:collections/dynamic": path.resolve(import.meta.dirname, "./.source/dynamic.ts"),
      // Force ESM entry — Rolldown's CJS interop generates a broken destructure
      // (`__toESM$1(...).default` → undefined) when tslib's CJS build is bundled
      // into SSR chunks as a transitive dependency of fumadocs/shiki.
      tslib: require.resolve("tslib/tslib.es6.mjs"),
    },
  },

  // Bundle these packages into SSR chunks instead of leaving them as external
  // runtime imports. This is required because:
  // - fumadocs-*: avoids React context errors and hydration mismatches
  // - tslib: the resolve alias rewrites it to ESM, but Nitro's external _libs/
  //   chunks resolve tslib via Node's exports map to modules/index.js which
  //   Nitro doesn't copy to .output
  // - @radix-ui/*: depends on tslib at runtime — bundling inlines the aliased
  //   ESM version instead of leaving broken external imports
  ssr: {
    noExternal: ["fumadocs-core", "fumadocs-ui", "tslib", /^@radix-ui\//],
  },

  // Polyfill node:path → path-browserify only during browser dep pre-bundling.
  // fumadocs-core/source uses path.join/dirname which don't exist in browsers.
  optimizeDeps: {
    rolldownOptions: {
      resolve: {
        alias: {
          "node:path": require.resolve("path-browserify"),
        },
      },
    },
  },

  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          return getManualChunkName(id);
        },
      },
    },
  },
}));
