#!/usr/bin/env node
/**
 * Prove SEA-55 backup/DR controls: R2 retention locks + recent audit tip backup.
 * Uses wrangler against production bindings (seal-documents / seal-global).
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const apiDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/api"
);

function wrangler(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: apiDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function pass(msg) {
  console.log(`PASS  ${msg}`);
}
function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}
function warn(msg) {
  console.warn(`WARN  ${msg}`);
}

const locks = wrangler(["r2", "bucket", "lock", "list", "seal-documents"]);
if (locks.includes("all-objects-7y")) {
  pass("R2 lock all-objects-7y present");
} else {
  fail("missing R2 lock all-objects-7y on seal-documents");
}
if (locks.includes("certificates-7y")) {
  pass("R2 lock certificates-7y present");
} else {
  fail("missing R2 lock certificates-7y on seal-documents");
}

const travel = wrangler([
  "d1",
  "time-travel",
  "info",
  "seal-global",
  "--env",
  "production",
]);
if (/bookmark/i.test(travel)) {
  pass("D1 Time Travel reachable for seal-global");
} else {
  fail("D1 Time Travel info did not return a bookmark");
}

const day = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
let foundBackup = false;
for (const d of [day, yesterday]) {
  const key = `seal-documents/backups/audit/${d}/manifest.json`;
  try {
    wrangler(["r2", "object", "get", key, "--remote", "--pipe"]);
    pass(`audit backup present for ${d}`);
    foundBackup = true;
    break;
  } catch {
    // try next day
  }
}
if (!foundBackup) {
  warn(
    `no backups/audit/{${yesterday},${day}}/manifest.json yet — expected within 36h of first SEA-55 cron`
  );
}

if (process.exitCode) {
  console.error("prove:backup-dr failed");
  process.exit(1);
}
console.log("prove:backup-dr ok");
