import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function manualChunks(moduleId: string): string | undefined {
  if (
    moduleId.includes("@embedpdf") ||
    moduleId.includes("pdfium")
  ) {
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
    moduleId.includes("@tanstack/react-query") ||
    moduleId.includes("@tanstack/query")
  ) {
    return "vendor-query";
  }

  return undefined;
}

/**
 * Emit hidden source maps for PostHog error tracking, then delete every `.map`
 * under the client asset tree so Cloudflare Assets never serves them.
 *
 * Upload (optional): set POSTHOG_CLI_API_KEY + POSTHOG_CLI_PROJECT_ID in CI and
 * run `posthog-cli sourcemap upload` against dist before this plugin removes maps,
 * or wire upload into cloudflare-ci. Without upload, maps are still never public.
 */
function stripPublicSourceMaps(outDir: string): Plugin {
  return {
    name: "seal-strip-public-sourcemaps",
    apply: "build",
    async closeBundle(): Promise<void> {
      const root = path.resolve(outDir);
      const queue: string[] = [root];

      while (queue.length > 0) {
        const dir = queue.pop();
        if (dir === undefined) {
          continue;
        }

        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            queue.push(fullPath);
            continue;
          }
          if (entry.isFile() && entry.name.endsWith(".map")) {
            await rm(fullPath, { force: true });
          }
        }
      }
    },
  };
}

export default defineConfig(() => {
  const defaultPort = Number(process.env.PORT || 5180);
  const outDir = "dist";

  return {
    plugins: [
      cloudflare(),
      tailwindcss(),
      tanstackRouter({}),
      react(),
      stripPublicSourceMaps(outDir),
    ],

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
      // Hidden: write .map files without //# sourceMappingURL so browsers never
      // request them. stripPublicSourceMaps removes them from dist before deploy.
      sourcemap: "hidden" as const,
      outDir,
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
