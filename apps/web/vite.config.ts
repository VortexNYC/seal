import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);

/**
 * CodeSplitting groups — replaces manualChunks (ignored when both set).
 * Tiny shared modules (icons) intentionally stay auto-split: grouping them
 * would defeat tree-shaking and force the whole set onto every page.
 */
const codeSplitting = {
  groups: [
    { name: "pdf-viewer", test: /@embedpdf|pdfium/ },
    { name: "canvas", test: /konva|react-zoom-pan-pinch/ },
    { name: "charts", test: /recharts|d3-/ },
    { name: "pdf-export", test: /jspdf|html2canvas/ },
    { name: "date-utils", test: /date-fns/ },
    {
      name: "ui",
      test: /@radix-ui|cmdk|sonner|react-day-picker/,
    },
    { name: "vendor-analytics", test: /posthog/ },
    { name: "vendor-query", test: /@tanstack\/(react-)?query/ },
  ],
};

function resolvePosthogCliEntry(): string | null {
  try {
    const pkgJson = require.resolve("@posthog/cli/package.json");
    return path.join(path.dirname(pkgJson), "run-posthog-cli.js");
  } catch {
    return null;
  }
}

async function uploadSourceMapsToPosthog(directory: string): Promise<void> {
  const apiKey = process.env.POSTHOG_CLI_API_KEY;
  const projectId =
    process.env.POSTHOG_CLI_PROJECT_ID ?? process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) {
    return;
  }

  const cliEntry = resolvePosthogCliEntry();
  if (cliEntry === null) {
    console.warn(
      "[seal] POSTHOG_CLI_API_KEY set but @posthog/cli is not installed; skipping sourcemap upload"
    );
    return;
  }

  const host = process.env.POSTHOG_CLI_HOST ?? "https://us.i.posthog.com";
  const releaseName = process.env.POSTHOG_CLI_RELEASE_NAME ?? "seal-web";
  const releaseVersion =
    process.env.POSTHOG_CLI_RELEASE_VERSION ??
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.GITHUB_SHA;

  const args = [
    cliEntry,
    "sourcemap",
    "process",
    "--directory",
    directory,
    "--release-name",
    releaseName,
  ];
  if (releaseVersion !== undefined && releaseVersion.length > 0) {
    args.push("--release-version", releaseVersion);
  }

  // Never fail the product build on PostHog CLI flakiness (ETXTBSY / untar
  // races in CI sandboxes). Maps are still deleted after closeBundle.
  await new Promise<void>((resolve) => {
    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        POSTHOG_CLI_API_KEY: apiKey,
        POSTHOG_CLI_PROJECT_ID: projectId,
        POSTHOG_CLI_HOST: host,
      },
      stdio: "inherit",
    });
    child.on("error", (error: Error) => {
      console.warn(
        `[seal] posthog-cli sourcemap upload failed: ${error.message}`
      );
      resolve();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        console.warn(
          `[seal] posthog-cli sourcemap process exited ${code ?? 1}; continuing build`
        );
      }
      resolve();
    });
  });
}

async function deleteMapFiles(root: string): Promise<void> {
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
}

/**
 * Emit hidden source maps for PostHog error tracking.
 * When POSTHOG_CLI_API_KEY + POSTHOG_CLI_PROJECT_ID are set, upload maps, then
 * always delete every `.map` under dist so Cloudflare Assets never serves them.
 */
function sealSourceMaps(outDir: string): Plugin {
  let uploaded = false;

  return {
    name: "seal-sourcemaps",
    apply: "build",
    async closeBundle(): Promise<void> {
      const root = path.resolve(outDir);
      // Cloudflare Vite plugin builds worker + client; upload once when maps exist.
      if (!uploaded) {
        uploaded = true;
        await uploadSourceMapsToPosthog(root);
      }
      await deleteMapFiles(root);
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
      // SEA-88: split route modules so auth does not pull PDF/canvas/charts.
      tanstackRouter({ autoCodeSplitting: true }),
      react(),
      sealSourceMaps(outDir),
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
      // request them. sealSourceMaps uploads (when keyed) then strips before deploy.
      sourcemap: "hidden" as const,
      outDir,
      chunkSizeWarningLimit: 1600,
      // SEA-88: named vendor chunks for lazy routes — never modulepreload heavies on auth.
      modulePreload: {
        resolveDependencies: (
          _filename: string,
          deps: string[],
          context: {
            hostId: string;
            hostType: "html" | "js";
          }
        ): string[] => {
          if (context.hostType !== "html") {
            return deps;
          }
          // Entry HTML must not preload document-surface vendors.
          const blocked = [
            "/pdf-viewer-",
            "/canvas-",
            "/charts-",
            "/pdf-export-",
            "/date-utils-",
            // posthog boots on idle (lib/posthog-client) — never preload.
            "/vendor-analytics-",
          ];
          return deps.filter(
            (dep) => !blocked.some((needle) => dep.includes(needle))
          );
        },
      },
      rollupOptions: {
        output: {
          codeSplitting,
        },
      },
    },

    preview: {
      port: defaultPort,
      strictPort: true,
    },
  };
});
