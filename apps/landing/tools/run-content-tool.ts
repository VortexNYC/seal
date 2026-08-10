/// <reference types="node" />

/**
 * Runs a content tool (manifest/search/sitemap generator) through Vite's own
 * Module Runner. The tools import `.source/server.ts`, which relies on
 * Vite-only features (`import.meta.glob`, the fumadocs-mdx plugin), so they
 * cannot run under plain tsx. vite-node 6 is incompatible with Vite 8's
 * rolldown dep optimizer (it polls a deps dir that is never written), so this
 * script — launched via tsx — replaces it with `createServerModuleRunner`.
 *
 * Usage: pnpm exec tsx tools/run-content-tool.ts <entry.ts>
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import { createServer, createServerModuleRunner } from "vite";

const entryArg = process.argv[2];

if (!entryArg) {
  console.error(
    "[run-content-tool] Usage: tsx tools/run-content-tool.ts <entry.ts>"
  );
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const entry = pathToFileURL(path.resolve(root, entryArg)).href;

const server = await createServer({
  configFile: path.join(root, "vite.config.ts"),
  root,
  server: { middlewareMode: true },
  // No browser is involved: skip client dep optimization entirely.
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const runner = createServerModuleRunner(server.environments.ssr, {
    hmr: false,
  });
  await runner.import(entry);
} catch (error: unknown) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`[run-content-tool] ${entryArg} failed:`, message);
  process.exitCode = 1;
} finally {
  await server.close();
}
