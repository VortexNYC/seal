import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

export default defineConfig(async ({ command }) => {
	const enableSentry = command === "build";

	return {
		plugins: [
			await mdx({}),
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
			},
			dedupe: ["react", "react-dom"],
			noExternal: ["fumadocs-core", "fumadocs-ui"],
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
