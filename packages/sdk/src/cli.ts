import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { createSealClient, type HttpMethod } from "./index.js";

const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function printUsage(): never {
  console.error(`Usage:
  seal <METHOD> <path> [body.json]
  seal upload <file> [--content-type <mime>]

Thin HTTP client over the Seal OpenAPI contract.
Authenticate with SEAL_API_KEY. Optional SEAL_BASE_URL (default https://api.seal.nyc).

Paths are relative to the base URL — include /api/v1.

Examples:
  seal upload ./contract.pdf
  seal POST /api/v1/documents create-doc.json
  seal GET  /api/v1/folders
  seal PUT  /api/v1/contacts/update update-contact.json
  seal GET  /api/v1/imports

upload prints { "storage_id", "content_type" } for use as storage_id on create document.
See https://docs.seal.nyc/reference for the full contract.
`);
  process.exit(1);
  throw new Error("unreachable");
}

function requireApiKey(): string {
  const apiKey = process.env.SEAL_API_KEY;
  if (!apiKey) {
    console.error("Error: SEAL_API_KEY is required");
    process.exit(1);
  }
  return apiKey;
}

function createClient() {
  return createSealClient({
    baseUrl: process.env.SEAL_BASE_URL ?? "https://api.seal.nyc",
    apiKey: requireApiKey(),
  });
}

async function runUpload(argv: string[]): Promise<void> {
  const filePath = argv[0];
  if (!filePath) {
    printUsage();
  }

  let contentType: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--content-type") {
      contentType = argv[i + 1];
      i++;
    }
  }

  const bytes = new Uint8Array(await readFile(filePath));
  const client = createClient();
  const result = await client.upload(bytes, {
    filename: basename(filePath),
    contentType,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function runRequest(
  method: string,
  path: string,
  bodyFile: string | undefined
): Promise<void> {
  const upperMethod = method.toUpperCase();
  if (!VALID_METHODS.includes(upperMethod as HttpMethod)) {
    console.error(`Error: unsupported METHOD: ${method}`);
    process.exit(1);
  }

  const client = createClient();
  const body = bodyFile
    ? (JSON.parse(await readFile(bodyFile, "utf-8")) as unknown)
    : undefined;

  const res = await client.request(upperMethod as HttpMethod, path, body);
  console.log(JSON.stringify(res, null, 2));
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) {
    printUsage();
  }

  if (cmd === "upload" || cmd === "--upload") {
    await runUpload(process.argv.slice(3));
    return;
  }

  const method = cmd;
  const path = process.argv[3];
  const bodyFile = process.argv[4];
  if (!path) {
    printUsage();
  }
  await runRequest(method, path, bodyFile);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
