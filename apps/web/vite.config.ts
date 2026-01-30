import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import { docs } from "./source.config";
import { searchIndexPlugin } from "./src/plugins/search-index";

export default defineConfig(async ({ command }) => {
	const enableSentry = command === "build";

	return {
		plugins: [
			await mdx({ docs: docs }, { updateViteConfig: true }),
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
				"@": path.resolve(__dirname, "./src"),
				"fumadocs-mdx:collections/server": path.resolve(
					__dirname,
					"./.source/server.ts",
				),
				"fumadocs-mdx:collections/browser": path.resolve(
					__dirname,
					"./.source/browser.ts",
				),
				"fumadocs-mdx:collections/dynamic": path.resolve(
					__dirname,
					"./.source/dynamic.ts",
				),
			},
			dedupe: ["react", "react-dom"],
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
				external: ["fumadocs-mdx:collections/server"],
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
