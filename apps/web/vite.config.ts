import path from "node:path";

import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function getManualChunkName(id: string): string | undefined {
  if (id.includes("react-pdf") || id.includes("pdfjs-dist")) {
    return "pdf-viewer";
  }

  if (id.includes("recharts")) {
    return "charts";
  }

  if (id.includes("date-fns")) {
    return "date-utils";
  }

  return undefined;
}

export default defineConfig(({ command }) => {
  const enableSentry = command === "build";

  return {
    plugins: [
      tailwindcss(),
      tanstackRouter({}),
      react(),
      // Sentry must be last so source maps from all other plugins are finalized
      enableSentry
        ? sentryVitePlugin({
            org: "plasma-vh",
            project: "seal",
            reactComponentAnnotation: { enabled: true },
            sourcemaps: {
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
          })
        : undefined,
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },

    // PostHog reverse proxy to bypass ad blockers
    server: {
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

    build: {
      sourcemap: "hidden",
      // SEA-136: Mobile performance optimization - chunk splitting for lazy loading
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            return getManualChunkName(id);
          },
        },
      },
    },
  };
});
