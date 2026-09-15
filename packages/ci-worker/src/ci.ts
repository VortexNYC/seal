import {
  CIWorkflow,
  type CiContext,
  type CiParams,
  type CloudflareArtifacts,
} from "@cloudflare/ci";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

const PROOF_STEP_TIMEOUT_MS = 20 * 60 * 1000;
const PROOF_COMMAND_TIMEOUT_MS = 19 * 60 * 1000 + 50 * 1000;
const DEPLOY_STEP_TIMEOUT_MS = 30 * 60 * 1000;
const DEPLOY_COMMAND_TIMEOUT_MS = 29 * 60 * 1000 + 50 * 1000;

const npmrcCommand =
  'printf "@%s:registry=https://npm.pkg.github.com\\n" vortexnyc > "$NPM_CONFIG_USERCONFIG" && printf "//npm.pkg.github.com/:_authToken=%s\\n" "$NPM_TOKEN" >> "$NPM_CONFIG_USERCONFIG"';

const sealEnv = {
  HOME: "/tmp",
  NPM_CONFIG_USERCONFIG: "/tmp/.npmrc",
  VITE_API_URL: "https://api.seal.nyc",
  VITE_BETTER_AUTH_URL: "https://api.seal.nyc",
  VITE_APP_URL: "https://app.seal.nyc",
};

// Run the proof in a writable /tmp copy of /workspace because the Cloudflare
// Sandbox mounts /workspace read-only for the command process.
const proofCommand = `sh -c 'rm -rf /tmp/ws && mkdir -p /tmp/ws && cp -a /workspace/. /tmp/ws/ && cd /tmp/ws && ${npmrcCommand} && pnpm install --frozen-lockfile && pnpm exec vp run build && pnpm exec vp check && pnpm exec vp run typecheck && pnpm exec vp run test'`;

const deployCommand = [
  "rm -rf /tmp/ws && mkdir -p /tmp/ws && cp -a /workspace/. /tmp/ws/ && cd /tmp/ws",
  npmrcCommand,
  "pnpm install --frozen-lockfile --silent",
  "pnpm exec vp run build",
  "cd apps/api && pnpm exec wrangler d1 migrations apply vortex-sign-global --env production --remote",
  "printf '%s' \"$BETTER_AUTH_SECRET\" | pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production",
  "printf '%s' \"$INTERNAL_API_KEY\" | pnpm exec wrangler secret put INTERNAL_API_KEY --env production",
  "printf '%s' \"$TOKEN_HASH_SECRET\" | pnpm exec wrangler secret put TOKEN_HASH_SECRET --env production",
  "printf '%s' \"$MCP_SIGNING_KEY\" | pnpm exec wrangler secret put MCP_SIGNING_KEY --env production",
  "pnpm exec wrangler deploy -e production",
  "cd ../anydoc-worker && pnpm exec wrangler deploy",
  "cd ../convert-worker && pnpm exec wrangler deploy",
  "cd ../mcp-worker && pnpm exec wrangler deploy",
  "cd ../web && pnpm exec wrangler deploy",
].join(" && ");

export class CI extends CIWorkflow<CloudflareArtifacts> {
  protected async pipeline(
    _event: WorkflowEvent<CiParams<CloudflareArtifacts>>,
    _step: WorkflowStep,
    ci: CiContext
  ): Promise<void> {
    await ci.runner({
      name: "proof",
      command: proofCommand,
      secrets: ["NPM_TOKEN"],
      env: sealEnv,
      cloudflareCredentials: false,
      config: {
        timeout: PROOF_STEP_TIMEOUT_MS,
        commandTimeoutMs: PROOF_COMMAND_TIMEOUT_MS,
      },
    });

    if (_event.payload.branch !== "main") {
      return;
    }

    await ci.runner({
      name: "deploy",
      command: `sh -c '${deployCommand}'`,
      secrets: [
        "NPM_TOKEN",
        "BETTER_AUTH_SECRET",
        "INTERNAL_API_KEY",
        "TOKEN_HASH_SECRET",
        "MCP_SIGNING_KEY",
      ],
      env: sealEnv,
      cloudflareCredentials: {
        accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      },
      config: {
        timeout: DEPLOY_STEP_TIMEOUT_MS,
        commandTimeoutMs: DEPLOY_COMMAND_TIMEOUT_MS,
      },
    });
  }
}
