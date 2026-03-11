import { createRequire } from "node:module";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

import * as SourceConfig from "./source.config";
import { searchIndexPlugin } from "./src/plugins/search-index";

const require = createRequire(import.meta.url);

function getManualChunkName(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/styled-components/")
  ) {
    return "vendor-styled";
  }

  if (
    id.includes("/@scalar/") ||
    id.includes("/swagger-") ||
    id.includes("/swagger-client/")
  ) {
    return "vendor-scalar";
  }

  if (
    id.includes("/framer-motion/") ||
    id.includes("/motion/")
  ) {
    return "vendor-motion";
  }

  if (
    id.includes("/@sanity/ui/")
  ) {
    return "vendor-sanity-ui";
  }

  if (
    id.includes("/@portabletext/") ||
    id.includes("/slate/")
  ) {
    return "vendor-editor";
  }

  if (
    id.includes("/sanity/")
  ) {
    return "vendor-studio";
  }

  if (
    id.includes("/@sanity/")
  ) {
    return "vendor-sanity";
  }

  if (
    id.includes("/groq")
  ) {
    return "vendor-groq";
  }

  if (
    id.includes("/fumadocs-") ||
    id.includes("/shiki/") ||
    id.includes("/refractor/")
  ) {
    return "vendor-docs";
  }

  return undefined;
}

export default defineConfig(async ({ command }) => ({
  server: {
    port: 3001,
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
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
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
    alias: {
      "fumadocs-mdx:collections/server": path.resolve(import.meta.dirname, "./.source/server.ts"),
      "fumadocs-mdx:collections/browser": path.resolve(import.meta.dirname, "./.source/browser.ts"),
      "fumadocs-mdx:collections/dynamic": path.resolve(import.meta.dirname, "./.source/dynamic.ts"),
    },
  },

  // Prevent Fumadocs packages from being externalized during SSR.
  // This avoids React context errors and hydration mismatches.
  ssr: {
    noExternal: ["fumadocs-core", "fumadocs-ui"],
  },

  // Polyfill node:path → path-browserify only during browser dep pre-bundling.
  // fumadocs-core/source uses path.join/dirname which don't exist in browsers.
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: "polyfill-node-path",
          setup(build: {
            onResolve: (opts: { filter: RegExp }, cb: () => { path: string }) => void;
          }) {
            build.onResolve({ filter: /^node:path$/ }, () => ({
              path: require.resolve("path-browserify"),
            }));
          },
        },
      ],
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          return getManualChunkName(id);
        },
      },
    },
  },
}));
