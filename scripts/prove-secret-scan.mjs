#!/usr/bin/env node
/**
 * Prove SEA-53 secret scanning controls.
 * The gate moved to cloudflare-ci (`checks` entry in src/repos.ts posting a
 * `secretlint` check run). Proves: branch protection still requires the
 * context, the latest run on main concluded success, and the same
 * `pnpm run scan:secrets` gate is clean locally.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "VortexNYC/seal";

function pass(msg) {
  console.log(`PASS  ${msg}`);
}
function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function gh(args) {
  return JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
}

// 1. Branch protection still requires the `secretlint` context on main.
try {
  const protection = gh([`repos/${REPO}/branches/main/protection`]);
  const contexts = (
    protection.required_status_checks?.checks ??
    protection.required_status_checks?.contexts ??
    []
  ).map((c) => (typeof c === "string" ? c : c.context));
  if (contexts.includes("secretlint")) {
    pass("main requires the `secretlint` status context");
  } else {
    fail(`required contexts ${JSON.stringify(contexts)} missing secretlint`);
  }
} catch (err) {
  fail(`branch protection lookup failed: ${err.message}`);
}

// 2. Latest `secretlint` check run on main's head concluded success.
try {
  const { sha } = gh([`repos/${REPO}/commits/main`]);
  const { check_runs } = gh([
    `repos/${REPO}/commits/${sha}/check-runs?check_name=secretlint&filter=latest&per_page=1`,
  ]);
  const run = check_runs?.[0];
  if (run?.conclusion === "success") {
    pass(`secretlint check green on main (${sha.slice(0, 7)})`);
  } else {
    fail(
      `secretlint on main is ${run ? `${run.status}/${run.conclusion}` : "missing"}`
    );
  }
} catch (err) {
  fail(`check run lookup failed: ${err.message}`);
}

// 3. The same gate CI runs is clean locally.
try {
  execFileSync("pnpm", ["run", "scan:secrets"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  pass("secretlint clean (pnpm run scan:secrets)");
} catch (err) {
  const stderr =
    err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
  fail(`secretlint failed${stderr ? `: ${stderr.slice(0, 500)}` : ""}`);
}

if (process.exitCode) {
  console.error("prove:secret-scan failed");
  process.exit(1);
}
console.log("prove:secret-scan ok");
