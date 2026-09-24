#!/usr/bin/env node
/**
 * Golden-path proof for seal.nyc (and selfhost with --api).
 *
 * Runs the OpenAPI-first CLI dogfood end-to-end:
 *   health → folders → contacts → upload → document → recipients → send
 *   → public viewed/signed → completed → org audit → imports
 *
 * Usage:
 *   SEAL_API_KEY=seal_… pnpm run prove:golden-path
 *   SEAL_API_KEY=… node scripts/prove-golden-path.mjs \
 *     --api https://seal-selfhost-api.<account>.workers.dev
 *
 * Exit 0 = pass, 1 = failure.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOGFOOD = join(ROOT, "scripts/dogfood-cli.mjs");

const forwarded = process.argv.slice(2);

if (!process.env.SEAL_API_KEY) {
  console.error("SEAL_API_KEY is required (Bearer token, seal_…)");
  process.exit(1);
}

console.log("=== Seal golden path (CLI dogfood + human signing half) ===\n");

const child = spawn(process.execPath, [DOGFOOD, ...forwarded], {
  env: process.env,
  stdio: "inherit",
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
