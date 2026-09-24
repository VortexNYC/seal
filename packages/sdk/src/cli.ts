import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createSealClient, type HttpMethod } from "./index.js";

const execFileAsync = promisify(execFile);

const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function printUsage(): never {
  console.error(`Usage:
  seal <METHOD> <path> [body.json]
  seal upload <file> [--content-type <mime>]
  seal wait --document <id> [--open] [--interval <ms>] [--timeout <ms>]
  seal wait --url <signing_url> --document <id> [--open] ...

Thin HTTP client over the Seal OpenAPI contract.
Authenticate with SEAL_API_KEY. Optional SEAL_BASE_URL (default https://api.seal.nyc).

Human handoff (agents prepare; humans act; agent resumes):
  seal wait --document <id> --open
    Fetches InteractionSession (GET /api/v1/documents/interaction), opens
    the human URL when available, polls until status is terminal, prints JSON.
    Agents never forge the signature. Same shape for future Veil/Pile kinds.

Examples:
  seal upload ./contract.pdf
  seal POST /api/v1/documents create-doc.json
  seal wait --document <id> --open
  seal GET  /api/v1/folders

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

async function openUrl(url: string): Promise<void> {
  const platform = process.platform;
  if (platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }
  if (platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
    return;
  }
  await execFileAsync("xdg-open", [url]);
}

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  return argv[i + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

type InteractionSession = {
  id?: string;
  kind?: string;
  url?: string | null;
  status?: string;
  message?: string;
  expires_at?: string | null;
  result?: {
    document_id?: string;
    document_status?: string;
    title?: string | null;
  };
  poll?: { path?: string; interval_ms?: number };
};

const TERMINAL = new Set([
  "completed",
  "cancelled",
  "declined",
  "expired",
]);

async function runWait(argv: string[]): Promise<void> {
  const documentId = flagValue(argv, "document");
  const urlFlag = flagValue(argv, "url");
  const shouldOpen = hasFlag(argv, "open");
  const intervalMs = Number(flagValue(argv, "interval") ?? "2000");
  const timeoutMs = Number(flagValue(argv, "timeout") ?? String(15 * 60 * 1000));

  if (!documentId) {
    console.error("Error: seal wait requires --document <id>");
    process.exit(1);
  }
  if (!Number.isFinite(intervalMs) || intervalMs < 250) {
    console.error("Error: --interval must be >= 250 ms");
    process.exit(1);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < intervalMs) {
    console.error("Error: --timeout must be >= --interval");
    process.exit(1);
  }

  const client = createClient();
  const base = process.env.SEAL_BASE_URL ?? "https://api.seal.nyc";

  const started = Date.now();
  let opened = false;
  let lastStatus = "";

  while (Date.now() - started < timeoutMs) {
    const session = (await client.request(
      "GET",
      `/api/v1/documents/interaction?id=${encodeURIComponent(documentId)}`
    )) as InteractionSession;

    const status = session.status ?? "unknown";
    const signingUrl = urlFlag ?? session.url ?? null;

    if (session.message && status !== lastStatus) {
      console.error(session.message);
    }
    if (status !== lastStatus) {
      console.error(`status=${status}`);
      lastStatus = status;
    }

    if (shouldOpen && !opened && signingUrl) {
      console.error(`Opening human interaction URL:\n  ${signingUrl}`);
      await openUrl(signingUrl);
      opened = true;
    } else if (!shouldOpen && signingUrl && status === "pending" && !opened) {
      console.error(
        `Human interaction URL (pass --open to launch browser):\n  ${signingUrl}`
      );
      opened = true;
    }

    if (TERMINAL.has(status)) {
      console.log(
        JSON.stringify(
          {
            ...session,
            document_id: documentId,
            signing_url: signingUrl,
            waited_ms: Date.now() - started,
            base_url: base,
          },
          null,
          2
        )
      );
      return;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.error(
    `Error: timed out after ${timeoutMs}ms waiting for document ${documentId} (last status=${lastStatus || "unknown"})`
  );
  process.exit(1);
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

  if (cmd === "wait") {
    await runWait(process.argv.slice(3));
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
