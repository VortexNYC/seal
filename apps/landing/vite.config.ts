import { createRequire } from "node:module";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

import * as SourceConfig from "./source.config";
import { searchIndexPlugin } from "./src/plugins/search-index";

const require = createRequire(import.meta.url);

export default defineConfig(async () => ({
  server: {
    port: 3001,
  },
  plugins: [
    await mdx(SourceConfig, { updateViteConfig: true }),
    searchIndexPlugin(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
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
}));
