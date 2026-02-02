/// <reference types="node" />

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const OUTPUT_DIR = path.resolve("public", "api");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "search.json");

async function generateSearchIndex(): Promise<void> {
	const server = await createServer({
		configFile: path.resolve("vite.config.ts"),
		server: { middlewareMode: true },
		appType: "custom",
		logLevel: "error",
	});

	try {
		const { searchAPI } = await server.ssrLoadModule("/src/lib/source.ts");
		const response = await searchAPI.staticGET();
		const data = await response.json();

		await mkdir(OUTPUT_DIR, { recursive: true });
		await writeFile(OUTPUT_FILE, JSON.stringify(data));
	} finally {
		await server.close();
	}
}

generateSearchIndex().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error("[search-index] Failed to export search index:", message);
	process.exitCode = 1;
});
