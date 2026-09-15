#!/usr/bin/env node
// Usage: R2_API_TOKEN=<r2-token-value> pnpm exec scripts/set-r2-secrets.mjs
// Sets R2_ACCESS_KEY_ID (token id) and R2_SECRET_ACCESS_KEY (SHA-256 of token value)
// as secrets on the vortex-sign-ci worker.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const token = process.env.R2_API_TOKEN;
if (!token) {
  console.error("Missing R2_API_TOKEN");
  process.exit(1);
}

const verifyResp = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
  headers: { Authorization: `Bearer ${token}` },
});

if (!verifyResp.ok) {
  console.error("Failed to verify R2_API_TOKEN:", verifyResp.status, await verifyResp.text());
  process.exit(1);
}

const verify = await verifyResp.json();
if (!verify.success) {
  console.error("R2_API_TOKEN verification failed:", JSON.stringify(verify.errors));
  process.exit(1);
}

const accessKeyId = verify.result.id;
const secretAccessKey = createHash("sha256").update(token).digest("hex");

for (const [name, value] of [
  ["R2_ACCESS_KEY_ID", accessKeyId],
  ["R2_SECRET_ACCESS_KEY", secretAccessKey],
]) {
  try {
    execFileSync("pnpm", ["exec", "wrangler", "secret", "put", name], {
      input: value,
      cwd: new URL("..", import.meta.url),
      stdio: ["pipe", "inherit", "inherit"],
    });
    console.log(`Set ${name}`);
  } catch (err) {
    console.error(`Failed to set ${name}:`, err.message);
    process.exit(1);
  }
}
