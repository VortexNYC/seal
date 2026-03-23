/// <reference types="node" />

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { searchAPI } from "../src/lib/docs/server-source";

const OUTPUT_DIR = path.resolve("public", "api");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "search.json");

export async function generateSearchIndex(): Promise<void> {
  const response = await searchAPI.staticGET();
  const data = await response.json();

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(data));
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  generateSearchIndex().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[search-index] Failed to export search index:", message);
    process.exitCode = 1;
  });
}
