import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(() => {
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

    if (moduleId.includes("posthog")) {
      return "vendor-analytics";
    }

    if (
      moduleId.includes("/convex/") &&
      !moduleId.includes("_generated") &&
      !moduleId.includes("convex-helpers")
    ) {
      return "vendor-convex";
    }

    if (
      moduleId.includes("@tanstack/react-query") ||
      moduleId.includes("@tanstack/query")
    ) {
      return "vendor-query";
    }

    return undefined;
  };

  return {
    plugins: [cloudflare(), tailwindcss(), tanstackRouter({}), react()],

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "pdfjs-dist": path.resolve(
          import.meta.dirname,
          "./node_modules/pdfjs-dist"
        ),
      },
      dedupe: ["react", "react-dom", "pdfjs-dist"],
    },

    // PostHog reverse proxy to bypass ad blockers
    server: {
      port: defaultPort,
      strictPort: true,
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
      sourcemap: false,
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
