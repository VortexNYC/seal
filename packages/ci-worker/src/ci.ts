import {
  CIWorkflow,
  isCiRunnerFailure,
  type CiContext,
  type CiParams,
  type CiRunnerFailureDiagnostics,
  type CloudflareArtifacts,
} from "@cloudflare/ci";
import type { CiBindings } from "@cloudflare/ci/worker";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

type CompleteEnv = Env &
  CiBindings & {
    NPM_TOKEN: string;
  };

const PROOF_STEP_TIMEOUT_MS = 20 * 60 * 1000;
const DEPLOY_STEP_TIMEOUT_MS = 30 * 60 * 1000;

const npmrcCommand =
  'printf "@%s:registry=https://npm.pkg.github.com\\n" vortexnyc > "$NPM_CONFIG_USERCONFIG" && printf "//npm.pkg.github.com/:_authToken=%s\\n" "$NPM_TOKEN" >> "$NPM_CONFIG_USERCONFIG"';

const sealEnv = {
  HOME: "/tmp",
  NPM_CONFIG_USERCONFIG: "/tmp/.npmrc",
  VITE_API_URL: "https://api.seal.nyc",
  VITE_BETTER_AUTH_URL: "https://api.seal.nyc",
  VITE_APP_URL: "https://app.seal.nyc",
};

const proofCommand = [
  npmrcCommand,
  "pnpm install --frozen-lockfile",
  "pnpm exec vp run build",
  "pnpm exec vp check",
  "pnpm exec vp run typecheck",
  "pnpm exec vp run test",
].join(" && ");

const deployCommand = [
  npmrcCommand,
  "pnpm install --frozen-lockfile --silent",
  "pnpm exec vp run build",
  "cd apps/api && pnpm exec wrangler d1 migrations apply vortex-sign-global --env production --remote",
  "pnpm exec wrangler deploy -e production",
  "cd ../anydoc-worker && pnpm exec wrangler deploy",
  "cd ../convert-worker && pnpm exec wrangler deploy",
  "cd ../mcp-worker && pnpm exec wrangler deploy",
  "cd ../web && pnpm exec wrangler deploy",
].join(" && ");

export class CI extends CIWorkflow<CloudflareArtifacts, CompleteEnv> {
  protected async pipeline(
    event: WorkflowEvent<CiParams<CloudflareArtifacts>>,
    _step: WorkflowStep,
    ci: CiContext
  ): Promise<void> {
    const proofResult = await ci.runner({
      name: "proof",
      command: proofCommand,
      env: sealEnv,
      secrets: ["NPM_TOKEN"],
      sourceControlCredentials: true,
      cloudflareCredentials: false,
      config: {
        timeout: PROOF_STEP_TIMEOUT_MS,
      },
    });

    if (event.payload.branch !== "main") {
      return;
    }

    try {
      await proofResult.runner({
        name: "deploy",
        command: deployCommand,
        env: sealEnv,
        secrets: ["NPM_TOKEN"],
        sourceControlCredentials: true,
        cloudflareCredentials: {
          accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
        },
        config: {
          timeout: DEPLOY_STEP_TIMEOUT_MS,
        },
      });
    } catch (error: unknown) {
      if (isCiRunnerFailure(error)) {
        const diagnostics = error.diagnostics as CiRunnerFailureDiagnostics | undefined;
        console.error("deploy runner failed", { error: error.message, diagnostics });
      } else {
        console.error("deploy runner failed", { error: String(error) });
      }
      throw error;
    }
  }
}
