import os from "node:os";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
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
  seal login [--org <slug>] [--scopes read,write,sign] [--open]
  seal logout

Thin HTTP client over the Seal OpenAPI contract.
Authenticate with SEAL_API_KEY or the key stored by seal login at
~/.seal/config.json. Optional SEAL_BASE_URL (default https://api.seal.nyc).

Human handoff (agents prepare; humans act; agent resumes):
  seal wait --document <id> --open
    Fetches InteractionSession (GET /api/v1/documents/interaction), opens
    the human URL when available, polls until status is terminal, prints JSON.
    Agents never forge the signature. Same shape for future Veil/Pile kinds.

Examples:
  seal login --open
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

function configPath(): string {
  return join(
    process.env.SEAL_CONFIG_DIR ?? join(os.homedir(), ".seal"),
    "config.json"
  );
}

function readStoredKey(): string | undefined {
  try {
    const raw = JSON.parse(
      readFileSync(configPath(), "utf-8")
    ) as { apiKey?: unknown };
    return typeof raw.apiKey === "string" ? raw.apiKey : undefined;
  } catch {
    return undefined;
  }
}

function requireApiKey(): string {
  const apiKey = process.env.SEAL_API_KEY ?? readStoredKey();
  if (!apiKey) {
    console.error("Error: SEAL_API_KEY is required (or run: seal login)");
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

async function runLogin(argv: string[]): Promise<void> {
  const base = process.env.SEAL_BASE_URL ?? "https://api.seal.nyc";
  const orgArg = flagValue(argv, "org");
  const scopesArg =
    flagValue(argv, "scopes") ?? "read,write,sign";
  const scopes = scopesArg.split(",").map((s) => s.trim()).filter(Boolean);
  const authBase = `${base}/api/auth`;

  const codeRes = await fetch(`${authBase}/device/code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: "seal-cli", scope: "openid" }),
  });
  if (!codeRes.ok) {
    console.error(`device/code failed: ${codeRes.status} ${await codeRes.text()}`);
    process.exit(1);
  }
  const grant = (await codeRes.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval?: number;
  };

  const url = grant.verification_uri_complete ?? grant.verification_uri;
  console.error(`Approve this device:\n  ${url}\ncode: ${grant.user_code}`);
  if (hasFlag(argv, "open")) {
    await openUrl(url);
  }

  const deadline = Date.now() + grant.expires_in * 1000;
  const intervalMs = Math.max((grant.interval ?? 5) * 1000, 1000);
  let sessionToken: string | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const tokenRes = await fetch(`${authBase}/device/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: grant.device_code,
        client_id: "seal-cli",
      }),
    });
    if (tokenRes.ok) {
      const body = (await tokenRes.json()) as { access_token?: string };
      sessionToken = body.access_token ?? null;
      break;
    }
    const err = (await tokenRes.json().catch(() => ({}))) as {
      error?: string;
    };
    if (err.error === "authorization_pending" || err.error === "slow_down") {
      continue;
    }
    console.error(`device/token failed: ${JSON.stringify(err)}`);
    process.exit(1);
  }
  if (!sessionToken) {
    console.error("Device authorization expired without approval.");
    process.exit(1);
  }

  const authed = (path: string, init?: RequestInit) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const orgsRes = await authed("/api/auth/organization/list");
  const orgs = (await orgsRes.json()) as Array<{ slug: string }>;
  const slug = orgArg ?? orgs[0]?.slug;
  if (!slug) {
    console.error("No organization membership found for this account.");
    process.exit(1);
  }
  if (orgs.length > 1 && !orgArg) {
    console.error(
      `Multiple orgs; using ${slug}. Pass --org <slug> to choose another.`
    );
  }

  const mintRes = await authed(
    `/api/v1/organizations/${encodeURIComponent(slug)}/tokens`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `seal-cli ${new Date().toISOString().slice(0, 10)}`,
        scopes,
      }),
    }
  );
  if (!mintRes.ok) {
    console.error(`token mint failed: ${mintRes.status} ${await mintRes.text()}`);
    process.exit(1);
  }
  const minted = (await mintRes.json()) as { token: string };

  const dir = join(
    process.env.SEAL_CONFIG_DIR ?? join(os.homedir(), ".seal")
  );
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    configPath(),
    JSON.stringify({ apiKey: minted.token, baseUrl: base, org: slug }, null, 2),
    { mode: 0o600 }
  );
  console.log(
    JSON.stringify({ ok: true, org: slug, config: configPath() }, null, 2)
  );
}

function runLogout(): void {
  try {
    rmSync(configPath());
    console.error(`Removed ${configPath()}`);
  } catch {
    console.error(`No config at ${configPath()}`);
  }
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

  if (cmd === "login") {
    await runLogin(process.argv.slice(3));
    return;
  }

  if (cmd === "logout") {
    runLogout();
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
