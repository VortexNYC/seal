import {
  CIWorkflow,
  type CiContext,
  type CiParams,
  type CloudflareArtifacts,
} from "@cloudflare/ci";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { Bindings } from "./env";

const MINUTE = 60 * 1000;

const stepConfig = {
  install: {
    timeoutMs: 20 * MINUTE,
    commandTimeoutMs: 19 * MINUTE + 50 * 1000,
  },
  check: {
    timeoutMs: 20 * MINUTE,
    commandTimeoutMs: 19 * MINUTE + 50 * 1000,
  },
  build: {
    timeoutMs: 20 * MINUTE,
    commandTimeoutMs: 19 * MINUTE + 50 * 1000,
  },
  migrate: {
    timeoutMs: 10 * MINUTE,
    commandTimeoutMs: 9 * MINUTE + 50 * 1000,
  },
  deploy: {
    timeoutMs: 45 * MINUTE,
    commandTimeoutMs: 44 * MINUTE + 50 * 1000,
  },
};

const installEnv = {
  HOME: "/tmp",
  NPM_CONFIG_USERCONFIG: "/tmp/.npmrc",
};

const buildEnv = {
  HOME: "/tmp",
  VITE_API_URL: "https://api.seal.nyc",
  VITE_BETTER_AUTH_URL: "https://api.seal.nyc",
  VITE_APP_URL: "https://app.seal.nyc",
};

const npmrcCommand =
  'printf "@%s:registry=https://npm.pkg.github.com\\n" vortexnyc > /tmp/.npmrc && ' +
  'printf "//npm.pkg.github.com/:_authToken=%s\\n" "$NPM_TOKEN" >> /tmp/.npmrc';

// Pipeline shape follows the Cloudflare Artifacts example:
// install -> parallel lint/test/typecheck/build -> migrate (main) -> deploy (main)
// Source: https://github.com/cloudflare/ci/blob/main/examples/cloudflare-artifacts/cloudflare.ci.ts
export class CI extends CIWorkflow<CloudflareArtifacts, Bindings> {
  protected async pipeline(
    _event: WorkflowEvent<CiParams<CloudflareArtifacts>>,
    _step: WorkflowStep,
    ci: CiContext
  ): Promise<void> {
    const branch = _event.payload.branch;

    const install = await ci.runner({
      name: "install",
      command: `${npmrcCommand} && pnpm install --frozen-lockfile`,
      cache: { inputs: ["package.json", "pnpm-lock.yaml"] },
      secrets: ["NPM_TOKEN"],
      env: installEnv,
      config: {
        timeout: stepConfig.install.timeoutMs,
        commandTimeoutMs: stepConfig.install.commandTimeoutMs,
      },
    });

    const [lint, typecheck, test, build] = await Promise.all([
      install.runner({
        name: "lint",
        command: "pnpm exec vp run lint",
        config: {
          timeout: stepConfig.check.timeoutMs,
          commandTimeoutMs: stepConfig.check.commandTimeoutMs,
        },
      }),
      install.runner({
        name: "typecheck",
        command: "pnpm exec vp run typecheck",
        config: {
          timeout: stepConfig.check.timeoutMs,
          commandTimeoutMs: stepConfig.check.commandTimeoutMs,
        },
      }),
      install.runner({
        name: "test",
        command: "pnpm exec vp run test",
        config: {
          timeout: stepConfig.check.timeoutMs,
          commandTimeoutMs: stepConfig.check.commandTimeoutMs,
        },
      }),
      install.runner({
        name: "build",
        command: "pnpm exec vp run build:all",
        env: buildEnv,
        config: {
          timeout: stepConfig.build.timeoutMs,
          commandTimeoutMs: stepConfig.build.commandTimeoutMs,
        },
      }),
    ]);

    void lint;
    void typecheck;
    void test;
    void build;

    if (branch !== "main") {
      return;
    }

    await install.runner({
      name: "migrate",
      command:
        "cd apps/api && pnpm exec wrangler d1 migrations apply vortex-sign-global --env production --remote",
      cloudflareCredentials: {
        accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      },
      config: {
        timeout: stepConfig.migrate.timeoutMs,
        commandTimeoutMs: stepConfig.migrate.commandTimeoutMs,
      },
    });

    await build.runner({
      name: "deploy",
      command: "pnpm exec vp run deploy",
      cloudflareCredentials: {
        accountId: this.env.CLOUDFLARE_DEPLOY_ACCOUNT_ID,
      },
      config: {
        timeout: stepConfig.deploy.timeoutMs,
        commandTimeoutMs: stepConfig.deploy.commandTimeoutMs,
      },
    });
  }
}
