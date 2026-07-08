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
const activeVortexMirrorSchemaPaths = [
  "apps/backend/convex/schemas/subscription_coupons.ts",
  "apps/backend/convex/schemas/subscription_promo_codes.ts",
] as const;
const retiredProviderAliasRegex = /\bretired provider\b|retired_provider|RETIRED_PROVIDER/i;
const stalePaymentProviderMirrorRegex = /\bpayment provider\b/i;
const generatedOrInstalledGlobExcludes = [
  "!.git/**",
  "!node_modules/**",
  "!**/node_modules/**",
  "!.cache/**",
  "!.turbo/**",
  "!**/.turbo/**",
  "!.openlogs/**",
  "!**/.openlogs/**",
  "!.playwright-mcp/**",
  "!**/.playwright-cli/**",
  "!**/.playwright-profile/**",
  "!**/.output/**",
  "!**/dist/**",
  "!test-results/**",
  "!**/test-results/**",
] as const;
const generatedOrInstalledDirectoryNames = new Set([
  ".git",
  "node_modules",
  ".cache",
  ".turbo",
  ".openlogs",
  ".playwright-mcp",
  ".playwright-cli",
  ".playwright-profile",
  ".output",
  "dist",
  "test-results",
]);

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
  [
    "--hidden",
    "--no-ignore",
    "-i",
    "-n",
    retiredProviderContentPattern,
    ".",
    ...generatedOrInstalledGlobExcludes.flatMap((glob) => ["--glob", glob]),
  ],
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

for (const relativePath of activeVortexMirrorSchemaPaths) {
  const absolutePath = join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath}: expected active Vortex mirror schema is missing`);
    continue;
  }

  const fileContents = readFileSync(absolutePath, "utf8");
  if (stalePaymentProviderMirrorRegex.test(fileContents)) {
    failures.push(`${relativePath}: active Vortex mirror schema uses stale payment provider wording`);
  }
  if (!fileContents.includes("Vortex Billing")) {
    failures.push(`${relativePath}: active Vortex mirror schema does not name Vortex Billing`);
  }
}

function scanWorkingTreePathNames(absoluteDirectory: string, relativeDirectory: string): void {
  if (!existsSync(absoluteDirectory)) {
    return;
  }

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedOrInstalledDirectoryNames.has(entry.name)) {
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
  "- No dependency graph package or owned working-tree path contains the retired provider token.",
);
console.log(
  "- No owned working-tree content, including hidden env files, contains provider-shaped retired provider residue.",
);
console.log("- No active guidance/config file contains retired provider aliases.");
console.log("- Active Vortex mirror schemas name Vortex Billing as source of truth.");
