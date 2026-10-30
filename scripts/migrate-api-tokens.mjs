#!/usr/bin/env node
/**
 * One-shot migration: legacy `api_tokens` rows → Better Auth `apikey` table.
 *
 * The plugin stores keys as base64url(SHA-256(token)); the legacy table stored
 * the same digest hex-encoded. Conversion is a pure re-encoding of the digest
 * bytes, so live `seal_…` keys keep working with no rotation.
 *
 * Field mapping:
 *   organization_id → reference_id          scopes → permissions {"seal":[…]}
 *   token_hash(hex) → key(base64url)        allowed_ip_ranges/user_id/public_id/revoked_at → metadata
 *   revoked_at → enabled=0                  last_used_at → last_request
 *
 * Usage:
 *   node scripts/migrate-api-tokens.mjs            # remote seal-global
 *   node scripts/migrate-api-tokens.mjs --local    # local dev DB (seal-dev)
 *   node scripts/migrate-api-tokens.mjs --db seal-selfhost --remote
 *
 * Idempotent: skips rows whose hash already exists in apikey.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "../apps/api");

const args = process.argv.slice(2);
const local = args.includes("--local");
const dbFlag = args.indexOf("--db");
const database =
  dbFlag >= 0 && args[dbFlag + 1]
    ? args[dbFlag + 1]
    : local
      ? "seal-dev"
      : "seal-global";

function d1(sql) {
  const base = ["exec", "wrangler", "d1", "execute", database];
  const out = execFileSync(
    "pnpm",
    [
      ...base,
      ...(local ? ["--local"] : ["--remote"]),
      "--json",
      "--command",
      sql,
    ],
    {
      cwd: apiDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

function hexToBase64Url(hex) {
  const bytes = new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  return Buffer.from(bytes).toString("base64url");
}

const q = (v) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const qNum = (v) => (v === null || v === undefined ? "NULL" : Number(v));

const rows = d1("SELECT * FROM api_tokens");
if (rows.length === 0) {
  console.log("No api_tokens rows — nothing to migrate.");
  process.exit(0);
}

let migrated = 0;
let skipped = 0;
for (const r of rows) {
  const existing = d1(
    `SELECT id FROM apikey WHERE key = ${q(hexToBase64Url(r.token_hash))}`
  );
  if (existing.length > 0) {
    skipped++;
    continue;
  }
  const revoked = r.revoked_at !== null;
  const metadata = JSON.stringify({
    publicId: r.public_id,
    userId: r.user_id,
    allowedIpRanges: JSON.parse(r.allowed_ip_ranges || "[]"),
    ...(revoked ? { revokedAt: new Date(r.revoked_at).toISOString() } : {}),
    migratedFrom: "api_tokens",
  });
  const permissions = JSON.stringify({ seal: JSON.parse(r.scopes || "[]") });
  const sql = `INSERT INTO apikey (
    id, config_id, name, start, reference_id, prefix, key,
    enabled, rate_limit_enabled, request_count,
    last_request, expires_at, created_at, updated_at,
    permissions, metadata
  ) VALUES (
    ${q(r.id)}, 'seal', ${q(r.name)}, NULL, ${q(r.organization_id)}, 'seal_',
    ${q(hexToBase64Url(r.token_hash))},
    ${revoked ? 0 : 1}, 0, 0,
    ${qNum(r.last_used_at)}, NULL, ${qNum(r.created_at)}, ${qNum(r.updated_at)},
    ${q(permissions)}, ${q(metadata)}
  )`;
  d1(sql);
  migrated++;
}

console.log(
  `api_tokens → apikey: ${migrated} migrated, ${skipped} already present (${rows.length} total, db=${database}${local ? " local" : " remote"})`
);
console.log(
  "Next: verify a live seal_ key still authenticates, then drop api_tokens in a follow-up migration."
);
