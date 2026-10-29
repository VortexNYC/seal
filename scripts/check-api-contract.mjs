#!/usr/bin/env node
/**
 * ADR-003 contract check — fails when the agent surface drifts from
 * apps/docs/openapi.yaml (the spec is the contract; code and MCP wrap it).
 *
 *  1. forward — every app.{get,post,put,delete,patch}("…") route in
 *     apps/api/src/api/v1/ must exist in the spec (path + method).
 *  2. reverse — every spec path+method must be implemented (no aspirational
 *     contract entries).
 *  3. mcp — every literal client call path in apps/mcp-worker/src/tools/
 *     must resolve to a specced path (dynamic ${id} segments → {}).
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Path + method keys from the spec's `paths:` block — no yaml dep needed
 *  (paths are 2-space-indented `/{...}:` keys, methods 4-space). */
function readSpecPaths() {
  const lines = readFileSync(
    resolve(root, "apps/docs/openapi.yaml"),
    "utf8"
  ).split("\n");
  const paths = new Map();
  let inPaths = false;
  let current = null;
  for (const line of lines) {
    if (/^paths:/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^\S/.test(line)) break; // left the paths block
    const p = line.match(/^  (\/\S+):\s*$/);
    if (p) {
      current = p[1];
      paths.set(current, new Set());
      continue;
    }
    const m = line.match(/^    (get|post|put|delete|patch|head|options):/);
    if (m && current) paths.get(current).add(m[1]);
  }
  return paths;
}
const specPaths = readSpecPaths();

// v1 file basename → spec path prefix (mount points are in index.ts)
const PREFIX = {
  documents: "/documents",
  "document-agent": "/documents",
  recipients: "/recipients",
  contacts: "/contacts",
  templates: "/templates",
  signatures: "/signatures",
  uploads: "/uploads",
  folders: "/folders",
  reviews: "/reviews",
  "review-packs": "/review-packs",
  revisions: "/revisions",
  jobs: "/jobs",
  webhooks: "/webhooks",
  tokens: "/organizations/{organizationSlug}/tokens",
  "audit-logs": "/organizations/{organizationSlug}/audit",
  audit: "/audit-log",
  account: "/account",
  settings: "/settings",
  analytics: "/analytics",
  search: "/search",
  "org-webhooks": "/organizations/{organizationSlug}/webhooks",
  imports: "/imports",
  members: "/members",
};
// helper modules, not routers
const NON_ROUTES = new Set(["download-token", "upload-token"]);
const METHODS = ["get", "post", "put", "delete", "patch"];

const norm = (p) => p.replace(/:([a-zA-Z_]+)|\{\w+\}/g, "{}");
const specNorm = new Map();
for (const [path, methods] of specPaths) {
  specNorm.set(norm(path), methods);
}

const problems = [];

// ── forward: code → spec ────────────────────────────────────────────────
const v1Dir = resolve(root, "apps/api/src/api/v1");
const codeRoutes = new Map(); // normalized path → Set<method>
for (const file of readdirSync(v1Dir)) {
  const name = file.replace(/\.ts$/, "");
  if (name.endsWith(".test") || NON_ROUTES.has(name)) continue;
  const prefix = PREFIX[name];
  if (!prefix) {
    problems.push(`v1/${file}: unmapped router — add it to PREFIX in this script`);
    continue;
  }
  const src = readFileSync(resolve(v1Dir, file), "utf8");
  for (const m of src.matchAll(/app\.(get|post|put|delete|patch)\("([^"]*)"/g)) {
    const [, method, sub] = m;
    const p = sub === "/" || sub === "" ? prefix : prefix + sub;
    codeRoutes.set(norm(p), (codeRoutes.get(norm(p)) ?? new Set()).add(method));
    if (!specNorm.has(norm(p))) {
      problems.push(`${method.toUpperCase()} ${p} (${name}.ts) — not in spec`);
    } else if (!specNorm.get(norm(p)).has(method)) {
      problems.push(
        `${method.toUpperCase()} ${p} (${name}.ts) — path specced, method missing`
      );
    }
  }
}

// ── reverse: spec → code ────────────────────────────────────────────────
for (const [np, methods] of specNorm) {
  for (const method of methods) {
    if (method === "parameters") continue;
    if (!codeRoutes.has(np) || !codeRoutes.get(np).has(method)) {
      problems.push(`spec ${method.toUpperCase()} ${np} — not implemented in v1`);
    }
  }
}

// ── mcp: tool client calls → spec ───────────────────────────────────────
const toolsDir = resolve(root, "apps/mcp-worker/src/tools");
for (const file of readdirSync(toolsDir)) {
  if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
  const src = readFileSync(resolve(toolsDir, file), "utf8");
  for (const m of src.matchAll(
    /client\.(get|post|put|delete|patch)(?:<[^>]*>)?\(\s*([`"'])([^`'"]+)\2/g
  )) {
    const [, method, , template] = m;
    const p = template.replace(/\$\{[^}]+\}/g, "{}");
    if (!specNorm.has(norm(p))) {
      problems.push(`mcp ${file}: ${method.toUpperCase()} ${p} — not in spec`);
    } else if (!specNorm.get(norm(p)).has(method)) {
      problems.push(
        `mcp ${file}: ${method.toUpperCase()} ${p} — method not in spec`
      );
    }
  }
}

if (problems.length) {
  console.error("OpenAPI contract drift detected:\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    "\nFix: spec new routes in apps/docs/openapi.yaml (the contract), or remove the code. See ADR-003."
  );
  process.exit(1);
}
console.log(
  `contract ok — ${codeRoutes.size} v1 routes, ${specNorm.size} spec paths, in sync`
);
