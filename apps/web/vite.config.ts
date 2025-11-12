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
	},

	build: {
		sourcemap: true,
	},
});
