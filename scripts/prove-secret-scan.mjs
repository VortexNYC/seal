#!/usr/bin/env node
/**
 * Prove SEA-53 secret scanning controls.
 * Runs the same secretlint gate as CI (`pnpm run scan:secrets`) and checks
 * that the Secret scan workflow is present in-tree.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = path.join(root, ".github/workflows/secret-scan.yml");

function pass(msg) {
  console.log(`PASS  ${msg}`);
}
function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

if (existsSync(workflow)) {
  pass("secret-scan.yml workflow present");
} else {
  fail("missing .github/workflows/secret-scan.yml");
}

try {
  execFileSync("pnpm", ["run", "scan:secrets"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  pass("secretlint clean (pnpm run scan:secrets)");
} catch (err) {
  const stderr =
    err && typeof err === "object" && "stderr" in err
      ? String(err.stderr)
      : "";
  fail(`secretlint failed${stderr ? `: ${stderr.slice(0, 500)}` : ""}`);
}

if (process.exitCode) {
  console.error("prove:secret-scan failed");
  process.exit(1);
}
console.log("prove:secret-scan ok");
