import { readFile } from "node:fs/promises";

import { createSealClient, type HttpMethod } from "./index.js";

const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function printUsage(): never {
  console.error(`Usage: seal <METHOD> <path> [body-file]

Thin HTTP client over the Seal OpenAPI contract (api.seal.nyc).
Authenticate with SEAL_API_KEY. Optional SEAL_BASE_URL (default https://api.seal.nyc).

Paths are relative to the base URL — include /api/v1.

Examples:
  seal GET  /api/v1/documents
  seal GET  /api/v1/folders
  seal POST /api/v1/folders create-folder.json
  seal PUT  /api/v1/contacts/update update-contact.json
  seal GET  /api/v1/imports
  seal POST /api/v1/imports create-import.json
  seal POST /api/v1/imports/<id>/approve

Body files are JSON. See https://docs.seal.nyc/reference for the full contract.
`);
  process.exit(1);
  throw new Error("unreachable");
}

async function main() {
  const method = process.argv[2];
  const path = process.argv[3];
  const bodyFile = process.argv[4];

  if (!method || !path) {
    printUsage();
  }

  const upperMethod = method.toUpperCase();
  if (!VALID_METHODS.includes(upperMethod as HttpMethod)) {
    console.error(`Error: unsupported METHOD: ${method}`);
    process.exit(1);
  }

  const apiKey = process.env.SEAL_API_KEY;
  if (!apiKey) {
    console.error("Error: SEAL_API_KEY is required");
    process.exit(1);
  }

  const baseUrl = process.env.SEAL_BASE_URL ?? "https://api.seal.nyc";
  const client = createSealClient({ baseUrl, apiKey });

  const body = bodyFile
    ? (JSON.parse(await readFile(bodyFile, "utf-8")) as unknown)
    : undefined;

  const res = await client.request(upperMethod as HttpMethod, path, body);
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
