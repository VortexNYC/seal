#!/usr/bin/env node
/**
 * Regenerate the MCP tool catalog section in apps/docs/docs/mcp/tool-catalog.mdx
 * from server.tool() registrations in apps/mcp-worker/src/tools/.
 *
 * Usage:
 *   node scripts/generate-mcp-tool-catalog.mjs
 *   node scripts/generate-mcp-tool-catalog.mjs --check
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(root, "apps/mcp-worker/src/tools");
const catalogPath = join(root, "apps/docs/docs/mcp/tool-catalog.mdx");

const CATEGORY_LABELS = {
  account: "Account",
  analytics: "Analytics",
  audit: "Audit log",
  contacts: "Contacts",
  document_agent: "Document PDF & preview",
  document_extra: "Document workflow",
  documents: "Documents",
  fields: "Fields & bindings",
  folders: "Folders",
  imports: "Imports",
  interaction: "Human handoff (InteractionSession)",
  members: "Members",
  recipients: "Recipients",
  reviews: "Review matrices",
  revisions: "Revisions",
  search: "Search",
  settings: "Settings",
  signatures: "Signatures & verification",
  templates: "Templates",
  tokens: "API tokens",
  uploads: "Uploads",
  webhooks: "Webhooks",
};

const TOOL_RE =
  /server\.tool\(\s*["'](seal_[^"']+)["'],\s*\n\s*"([^"]*)"/gs;

function collectTools() {
  /** @type {Map<string, { name: string; desc: string; file: string }[]>} */
  const byCategory = new Map();

  for (const file of readdirSync(toolsDir).filter((f) => f.endsWith(".ts"))) {
    const stem = file.replace(/\.ts$/, "");
    const source = readFileSync(join(toolsDir, file), "utf8");
    const list = [];
    for (const match of source.matchAll(TOOL_RE)) {
      list.push({
        name: match[1],
        desc: match[2].replace(/\s+/g, " ").trim(),
        file: stem,
      });
    }
    if (list.length > 0) {
      list.sort((a, b) => a.name.localeCompare(b.name));
      byCategory.set(stem, list);
    }
  }
  return byCategory;
}

function renderCatalog(byCategory) {
  const total = [...byCategory.values()].reduce((n, list) => n + list.length, 0);
  const lines = [
    `<!-- GENERATED:START — ${total} tools; do not edit by hand -->`,
    "",
    `**${total} tools** registered in \`apps/mcp-worker/src/tools/\`.`,
    "Regenerate: \`pnpm run generate:mcp-tool-catalog\`.",
    "",
  ];

  for (const stem of [...byCategory.keys()].sort((a, b) => a.localeCompare(b))) {
    const label = CATEGORY_LABELS[stem] ?? stem;
    const tools = byCategory.get(stem);
    if (!tools) continue;
    lines.push(`### ${label}`, "");
    lines.push("| Tool | Summary |");
    lines.push("| ---- | ------- |");
    for (const tool of tools) {
      const desc = tool.desc.replace(/\|/g, "\\|");
      lines.push(`| \`${tool.name}\` | ${desc} |`);
    }
    lines.push("");
  }

  lines.push("<!-- GENERATED:END -->", "");
  return lines.join("\n");
}

function readTemplate() {
  return readFileSync(catalogPath, "utf8");
}

function replaceGeneratedBlock(template, generated) {
  const start = "<!-- GENERATED:START";
  const end = "<!-- GENERATED:END -->";
  const i = template.indexOf(start);
  const j = template.indexOf(end);
  if (i === -1 || j === -1) {
    throw new Error(
      `Missing GENERATED markers in ${catalogPath} — add GENERATED:START/END block`
    );
  }
  const after = j + end.length;
  return template.slice(0, i) + generated.trimEnd() + template.slice(after);
}

function main() {
  const check = process.argv.includes("--check");
  const byCategory = collectTools();
  const generated = renderCatalog(byCategory);
  const next = replaceGeneratedBlock(readTemplate(), generated);

  if (check) {
    const current = readTemplate();
    if (current !== next) {
      console.error(
        "MCP tool catalog is stale. Run: pnpm run generate:mcp-tool-catalog"
      );
      process.exit(1);
    }
    console.log("MCP tool catalog is up to date.");
    return;
  }

  writeFileSync(catalogPath, next);
  const total = [...byCategory.values()].reduce((n, list) => n + list.length, 0);
  console.log(`Wrote ${catalogPath} (${total} tools).`);
}

main();
