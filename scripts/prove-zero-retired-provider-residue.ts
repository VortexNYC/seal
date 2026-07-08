#!/usr/bin/env bun

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const retiredProviderToken = String.fromCharCode(115, 116, 114, 105, 112, 101);
const retiredProviderContentPattern = `\\b${retiredProviderToken}\\b|@${retiredProviderToken}/|${retiredProviderToken}[_-]`;
const retiredProviderContentRegex = new RegExp(retiredProviderContentPattern, "i");
const activeConfigExamplePaths = [
  ".env.example",
  ".test-env.example",
  "apps/backend/.env.example",
  "apps/web/.env.example",
  "apps/landing/.env.example",
] as const;
const activeGuidanceAndConfigPaths = [
  ...activeConfigExamplePaths,
  "AGENTS.md",
  "CLAUDE.md",
  "LLM-INTEGRATION.md",
  "README.md",
  "goal.md",
  "turbo.json",
  "vortex.project.json",
] as const;
const retiredProviderAliasRegex = /\bretired provider\b|retired_provider|RETIRED_PROVIDER/i;

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\0")
  .filter((path) => path.length > 0);

const failures: string[] = [];

const dependencyGraph = spawnSync("bun", ["pm", "why", retiredProviderToken], {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const dependencyGraphOutput = `${dependencyGraph.stdout}${dependencyGraph.stderr}`;
if (dependencyGraph.status === 0 || !dependencyGraphOutput.includes("No packages matching")) {
  failures.push("bun.lock: dependency graph contains retired provider package");
}

const workingTreeContent = spawnSync(
  "rg",
  ["--no-ignore", "-i", "-n", retiredProviderContentPattern, ".", "--glob", "!.git/**"],
  {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (workingTreeContent.status === 0) {
  failures.push(
    `working tree content contains retired provider token:\n${workingTreeContent.stdout}`,
  );
} else if (workingTreeContent.status !== 1) {
  failures.push(
    `working tree content scan failed: ${workingTreeContent.stderr || workingTreeContent.stdout}`,
  );
}

for (const relativePath of trackedFiles) {
  if (relativePath.toLowerCase().includes(retiredProviderToken)) {
    failures.push(`${relativePath}: path contains retired provider token`);
    continue;
  }

  const absolutePath = join(repoRoot, relativePath);
  if (!statSync(absolutePath).isFile()) {
    continue;
  }

  const fileBytes = readFileSync(absolutePath);
  const fileContents = fileBytes.toString("utf8");
  if (fileContents.toLowerCase().includes(retiredProviderToken)) {
    failures.push(`${relativePath}: tracked content contains retired provider token`);
    continue;
  }
  if (retiredProviderContentRegex.test(fileContents)) {
    failures.push(`${relativePath}: tracked content contains retired provider residue`);
  }
}

for (const relativePath of activeGuidanceAndConfigPaths) {
  const absolutePath = join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    continue;
  }

  const fileContents = readFileSync(absolutePath, "utf8");
  if (retiredProviderAliasRegex.test(fileContents)) {
    failures.push(`${relativePath}: active guidance/config contains retired provider alias`);
  }
}

function scanWorkingTreePathNames(absoluteDirectory: string, relativeDirectory: string): void {
  if (!existsSync(absoluteDirectory)) {
    return;
  }

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    if (relativeDirectory === "." && entry.name === ".git") {
      continue;
    }

    const relativePath =
      relativeDirectory === "." ? entry.name : `${relativeDirectory}/${entry.name}`;
    if (relativePath.toLowerCase().includes(retiredProviderToken)) {
      failures.push(`${relativePath}: working tree path contains retired provider token`);
    }

    if (entry.isDirectory()) {
      scanWorkingTreePathNames(join(absoluteDirectory, entry.name), relativePath);
    }
  }
}

scanWorkingTreePathNames(repoRoot, ".");

if (failures.length > 0) {
  console.error("Retired provider residue proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Retired provider residue proof passed:");
console.log("- No tracked file paths contain the retired provider token.");
console.log("- No tracked file contents contain the retired provider token.");
console.log(
  "- No dependency graph package or working-tree path outside .git contains the retired provider token.",
);
console.log(
  "- No working-tree content outside .git contains provider-shaped retired provider residue.",
);
console.log("- No active guidance/config file contains retired provider aliases.");
