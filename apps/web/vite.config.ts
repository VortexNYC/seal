import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		tanstackRouter({}),
		react(),
		sentryVitePlugin({
			org: "plasma-vh",
			project: "seal",
		}) as PluginOption,
	],

	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
		dedupe: ["react", "react-dom"],
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
});
