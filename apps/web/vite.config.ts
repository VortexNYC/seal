import { createRequire } from "node:module";
import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import * as SourceConfig from "./source.config";
import { searchIndexPlugin } from "./src/plugins/search-index";

const require = createRequire(import.meta.url);

export default defineConfig(async ({ command }) => {
	const enableSentry = command === "build";

	return {
		plugins: [
			await mdx(SourceConfig, { updateViteConfig: true }),
			searchIndexPlugin(),
			tailwindcss(),
			tanstackRouter({}),
			react(),
			enableSentry
				? sentryVitePlugin({
						org: "plasma-vh",
						project: "seal",
					})
				: undefined,
		].filter(Boolean),

		resolve: {
			alias: {
				"@": path.resolve(import.meta.dirname, "./src"),
				"fumadocs-mdx:collections/server": path.resolve(
					import.meta.dirname,
					"./.source/server.ts",
				),
				"fumadocs-mdx:collections/browser": path.resolve(
					import.meta.dirname,
					"./.source/browser.ts",
				),
				"fumadocs-mdx:collections/dynamic": path.resolve(
					import.meta.dirname,
					"./.source/dynamic.ts",
				),
			},
			dedupe: ["react", "react-dom"],
		},

		// Prevent Fumadocs packages from being externalized during SSR.
		// This avoids React context errors and hydration mismatches.
		ssr: {
			noExternal: ["fumadocs-core", "fumadocs-ui"],
		},

		// Polyfill node:path → path-browserify only during browser dep pre-bundling.
		// This handles fumadocs-core/source and fumadocs-mdx/runtime/server which
		// use path.join/dirname. SSR (search index) uses real node:path unaffected.
		optimizeDeps: {
			esbuildOptions: {
				plugins: [
					{
						name: "polyfill-node-path",
						setup(build: {
							onResolve: (
								opts: { filter: RegExp },
								cb: () => { path: string },
							) => void;
						}) {
							build.onResolve({ filter: /^node:path$/ }, () => ({
								path: require.resolve("path-browserify"),
							}));
						},
					},
				],
			},
		},

		// PostHog reverse proxy to bypass ad blockers
		server: {
			proxy: {
				"/ingest/static": {
					target: "https://us-assets.i.posthog.com",
					changeOrigin: true,
					rewrite: (pathStr: string) =>
						pathStr.replace(/^\/ingest\/static/, "/static"),
				},
				"/ingest": {
					target: "https://us.i.posthog.com",
					changeOrigin: true,
					rewrite: (pathStr: string) => pathStr.replace(/^\/ingest/, ""),
				},
			},
		},

		build: {
			sourcemap: true,
			// SEA-136: Mobile performance optimization - chunk splitting for lazy loading
			rollupOptions: {
				output: {
					manualChunks: {
						// Large PDF library - lazy loaded on signing/document pages
						"pdf-viewer": ["react-pdf", "pdfjs-dist"],
						// Charts library - only used on dashboard
						charts: ["recharts"],
						// Date utilities
						"date-utils": ["date-fns"],
					},
				},
			},
		},
	};
});
