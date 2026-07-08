#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const retiredProviderToken = String.fromCharCode(115, 116, 114, 105, 112, 101);
const archivePrefix = "docs/archive/";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\0")
  .filter((path) => path.length > 0);

const failures: string[] = [];

for (const relativePath of trackedFiles) {
  if (relativePath.startsWith(archivePrefix)) {
    continue;
  }

  if (relativePath.toLowerCase().includes(retiredProviderToken)) {
    failures.push(`${relativePath}: path contains retired provider token`);
    continue;
  }

  const absolutePath = join(repoRoot, relativePath);
  if (!statSync(absolutePath).isFile()) {
    continue;
  }

  const fileBytes = readFileSync(absolutePath);
  if (fileBytes.toString("utf8").toLowerCase().includes(retiredProviderToken)) {
    failures.push(`${relativePath}: content contains retired provider token`);
  }
}

if (failures.length > 0) {
  console.error("Retired provider residue proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Retired provider residue proof passed:");
console.log("- No tracked active file paths or contents contain the retired provider token.");
console.log("- Historical docs under docs/archive are the only allowed exception.");
