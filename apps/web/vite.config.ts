import path from "node:path";

import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const enableSentry = command === "build";
  const defaultPort = Number(process.env.PORT || 5180);
  const manualChunks = (moduleId: string): string | undefined => {
    if (moduleId.includes("react-pdf") || moduleId.includes("pdfjs-dist")) {
      return "pdf-viewer";
    }

    if (
      moduleId.includes("konva") ||
      moduleId.includes("react-konva") ||
      moduleId.includes("react-zoom-pan-pinch")
    ) {
      return "canvas";
    }

    if (moduleId.includes("recharts") || moduleId.includes("d3-")) {
      return "charts";
    }

    if (moduleId.includes("jspdf") || moduleId.includes("html2canvas")) {
      return "pdf-export";
    }

    if (moduleId.includes("date-fns")) {
      return "date-utils";
    }

    if (
      moduleId.includes("@radix-ui") ||
      moduleId.includes("cmdk") ||
      moduleId.includes("sonner") ||
      moduleId.includes("react-day-picker")
    ) {
      return "ui";
    }

    if (moduleId.includes("@clerk") || moduleId.includes("posthog")) {
      return "vendor-auth";
    }

    if (moduleId.includes("@stripe")) {
      return "vendor-stripe";
    }

    if (
      moduleId.includes("/convex/") &&
      !moduleId.includes("_generated") &&
      !moduleId.includes("convex-helpers")
    ) {
      return "vendor-convex";
    }

    if (moduleId.includes("@tanstack/react-query") || moduleId.includes("@tanstack/query")) {
      return "vendor-query";
    }

    return undefined;
  };

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
            // Disabled: adds significant build time with Rolldown and provides
            // limited value — Sentry can infer component names from sourcemaps.
            reactComponentAnnotation: { enabled: false },
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
      port: defaultPort,
      strictPort: true,
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
      chunkSizeWarningLimit: 1600,
      // SEA-136: Mobile performance optimization - chunk splitting for lazy loading
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },

    preview: {
      port: defaultPort,
      strictPort: true,
    },
  };
});
