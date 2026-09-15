import {
  cloudflareArtifacts,
  type CiParams,
  type CiWorkflowPayload,
  type CloudflareArtifacts,
} from "@cloudflare/ci";
import { getSandbox, type DirectoryBackup } from "@cloudflare/sandbox";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from "cloudflare:workers";

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

const proofCommand = `sh -c '${npmrcCommand} && pnpm install --frozen-lockfile && pnpm exec vp run build && pnpm exec vp check && pnpm exec vp run typecheck && pnpm exec vp run test'`;

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

const WORKSPACE_DIR = "/workspace";
const STDOUT_FILE = "/tmp/ci-step.out";
const STDERR_FILE = "/tmp/ci-step.err";
const TAIL_BYTES = 28_000;
const SOURCE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_STEP_TIMEOUT_MS = 12 * 60 * 1000;
const COMMAND_TIMEOUT_MARGIN_MS = 10_000;
const PORT_READY_TIMEOUT_MS = 60_000;

type SourceProvider = ReturnType<
  ReturnType<typeof cloudflareArtifacts>["create"]
>;
type Checkout = Awaited<ReturnType<SourceProvider["getSourceCheckout"]>>;
type SandboxHandle = ReturnType<typeof getSandbox>;
type CiBindings = Parameters<
  ReturnType<typeof cloudflareArtifacts>["create"]
>[0];

type CompleteEnv = Env & {
  CF_TOKEN: string;
  NPM_TOKEN: string;
};

type RunnerOptions = {
  name: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  secrets?: string[];
  cloudflareCredentials?: boolean | { accountId: string };
  sourceControlCredentials?: boolean;
  config?: {
    timeout?: number;
    commandTimeoutMs?: number;
    retries?: WorkflowStepConfig["retries"];
    snapshotRetentionSeconds?: number;
  };
};

type StepResult = {
  exitCode: number;
  logs: { stdout: string; stderr: string };
  preview: { stdout: string; stderr: string };
  snapshot: DirectoryBackup;
};

type RunnerResult = StepResult & {
  runner: (options: RunnerOptions) => Promise<RunnerResult>;
};

type CiContext = {
  runner: (options: RunnerOptions) => Promise<RunnerResult>;
};

export class CI extends WorkflowEntrypoint<
  CompleteEnv,
  CiWorkflowPayload<CloudflareArtifacts>
> {
  private readonly adapter = cloudflareArtifacts();

  async run(
    event: WorkflowEvent<CiWorkflowPayload<CloudflareArtifacts>>,
    step: WorkflowStep
  ): Promise<{ conclusion: "success" }> {
    const provider = this.adapter.create(this.env as unknown as CiBindings);
    const payload = await this.normalizePayload(event.payload, provider);
    if (!payload) {
      return { conclusion: "success" };
    }

    this.adapter.assertSource({
      provider: payload.provider,
      owner: payload.owner,
      repo: payload.repo,
    });

    const pipelineEvent = { ...event, payload } as WorkflowEvent<
      CiParams<CloudflareArtifacts>
    >;
    const ci = this.ciContext(pipelineEvent, step, provider);
    await this.pipeline(pipelineEvent, step, ci);
    return { conclusion: "success" };
  }

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
      secrets: ["NPM_TOKEN"],
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

  private async normalizePayload(
    payload: Readonly<CiWorkflowPayload<CloudflareArtifacts>>,
    provider: SourceProvider
  ): Promise<CiParams<CloudflareArtifacts> | null> {
    if ("provider" in payload) {
      return payload as CiParams<CloudflareArtifacts>;
    }

    const event = await provider.receiveEvent({
      body: JSON.stringify(payload),
      headers: new Headers(),
    });
    return event?.type === "run"
      ? (event.params as CiParams<CloudflareArtifacts>)
      : null;
  }

  private ciContext(
    event: WorkflowEvent<CiParams<CloudflareArtifacts>>,
    step: WorkflowStep,
    provider: SourceProvider
  ): CiContext {
    return Object.freeze({
      runner: (options: RunnerOptions) =>
        this.runStep(options, event.payload, step, provider),
    });
  }

  private async runStep(
    options: RunnerOptions,
    payload: CiParams<CloudflareArtifacts>,
    step: WorkflowStep,
    provider: SourceProvider
  ): Promise<RunnerResult> {
    const source = {
      owner: payload.owner,
      repo: payload.repo,
      ref: payload.ref,
      sha: payload.sha,
      providerData: payload.providerData,
    };

    const checkout = await provider.getSourceCheckout(source);
    const extraEnv: Record<string, string> = { CI: "true", ...options.env };

    if (
      options.cloudflareCredentials !== undefined &&
      options.cloudflareCredentials !== false
    ) {
      extraEnv.CLOUDFLARE_API_TOKEN = this.env.CF_TOKEN;
      if (
        typeof options.cloudflareCredentials === "object" &&
        options.cloudflareCredentials.accountId
      ) {
        extraEnv.CLOUDFLARE_ACCOUNT_ID =
          options.cloudflareCredentials.accountId;
      }
    }

    if (options.sourceControlCredentials) {
      Object.assign(extraEnv, await provider.getStepCredentialEnv(source));
    }

    for (const name of options.secrets ?? []) {
      const value = this.env[name as keyof CompleteEnv];
      if (typeof value !== "string") {
        throw new Error(
          `Secret ${name} is either not configured on ci-cd-worker or not a string.`
        );
      }
      extraEnv[name] = value;
    }

    const commandTimeoutMs =
      options.config?.commandTimeoutMs ??
      Math.max(
        1,
        (options.config?.timeout ?? DEFAULT_STEP_TIMEOUT_MS) -
          COMMAND_TIMEOUT_MARGIN_MS
      );

    const stepConfig: WorkflowStepConfig = {
      retries: options.config?.retries ?? {
        limit: 2,
        delay: 30_000,
        backoff: "linear",
      },
      timeout: options.config?.timeout ?? DEFAULT_STEP_TIMEOUT_MS,
    };

    const output = await step.do<StepResult>(
      options.name,
      stepConfig,
      async () => {
        const sandbox = getSandbox(
          this.env.SANDBOX,
          `${slugify(options.name)}-${crypto.randomUUID()}`,
          {
            transport: "http",
            enableDefaultSession: false,
            containerTimeouts: { portReadyTimeoutMS: PORT_READY_TIMEOUT_MS },
          }
        );

        try {
          await sandbox.exec(checkoutSourceScript(checkout, WORKSPACE_DIR), {
            cwd: "/",
            timeout: SOURCE_TIMEOUT_MS,
            env: checkoutSourceEnv(checkout),
          });

          const cwd = resolveCwd(options.cwd);
          const command = `(set -o pipefail; ${options.command}) > ${STDOUT_FILE} 2> ${STDERR_FILE}`;
          const proc = await sandbox.startProcess(command, {
            cwd,
            env: extraEnv,
            autoCleanup: false,
          });

          const { exitCode } = await proc.waitForExit(commandTimeoutMs);
          const preview = await readPreviews(sandbox);

          if (exitCode !== 0) {
            const { stdout, stderr } = redact(
              { ...extraEnv, ...checkoutSourceEnv(checkout) },
              preview
            );
            throw new Error(
              `${options.name} failed with exit code ${exitCode}\n=== stdout ===\n${stdout}\n=== stderr ===\n${stderr}`
            );
          }

          const logs = await readLogs(sandbox);

          return {
            exitCode,
            logs: redact({ ...extraEnv, ...checkoutSourceEnv(checkout) }, logs),
            preview: redact(
              { ...extraEnv, ...checkoutSourceEnv(checkout) },
              preview
            ),
            snapshot: { id: crypto.randomUUID(), dir: WORKSPACE_DIR },
          };
        } finally {
          try {
            await sandbox.destroy();
          } catch {
            // ignore cleanup failures
          }
        }
      }
    );

    return Object.freeze({
      ...output,
      runner: (nextOptions: RunnerOptions) =>
        this.runStep(nextOptions, payload, step, provider),
    });
  }
}

function redact(
  env: Record<string, string | undefined> | undefined,
  logs: { stdout: string; stderr: string }
): { stdout: string; stderr: string } {
  if (!env) return logs;
  const values = Object.values(env).filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  return {
    stdout: values.reduce((s, v) => s.replaceAll(v, "***"), logs.stdout),
    stderr: values.reduce((s, v) => s.replaceAll(v, "***"), logs.stderr),
  };
}

async function readLogs(
  sandbox: SandboxHandle
): Promise<{ stdout: string; stderr: string }> {
  const [stdout, stderr] = await Promise.all([
    readFileString(sandbox, STDOUT_FILE),
    readFileString(sandbox, STDERR_FILE),
  ]);
  return { stdout, stderr };
}

async function readFileString(
  sandbox: SandboxHandle,
  file: string
): Promise<string> {
  try {
    const result = await sandbox.readFile(file, { encoding: "utf-8" });
    return result.success ? result.content : "";
  } catch {
    return "";
  }
}

async function readPreviews(
  sandbox: SandboxHandle
): Promise<{ stdout: string; stderr: string }> {
  const [stdout, stderr] = await Promise.all([
    tailFile(sandbox, STDOUT_FILE),
    tailFile(sandbox, STDERR_FILE),
  ]);
  return { stdout, stderr };
}

async function tailFile(sandbox: SandboxHandle, file: string): Promise<string> {
  const result = await sandbox.exec(
    `tail -c ${TAIL_BYTES} ${file} 2>/dev/null || true`,
    { cwd: "/", timeout: 30_000 }
  );
  return result.stdout ?? "";
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function checkoutSourceScript(
  source: Checkout,
  workspace: string,
  overlay = false
): string {
  const sourceDir = "/tmp/ci-source";
  const prepare = overlay
    ? `mkdir -p ${shellQuote(workspace)}`
    : `rm -rf ${shellQuote(workspace)} && mkdir -p ${shellQuote(workspace)}`;

  if (source.kind === "archive") {
    return `${prepare} && curl --connect-timeout 10 --max-time 300 --fail --silent --show-error --location ${shellQuote(
      source.url
    )} | tar -xz --strip-components=1 -C ${shellQuote(workspace)}`;
  }

  return [
    prepare,
    `rm -rf ${shellQuote(sourceDir)}`,
    `git init -q ${shellQuote(sourceDir)}`,
    `git -C ${shellQuote(sourceDir)} remote add origin ${shellQuote(source.remote)}`,
    `git -c http.extraHeader="Authorization: Bearer $SOURCE_CONTROL_TOKEN" -C ${shellQuote(
      sourceDir
    )} fetch --depth=1 origin ${shellQuote(source.sha)}`,
    `git -C ${shellQuote(sourceDir)} checkout --detach FETCH_HEAD`,
    `tar --exclude=.git -C ${shellQuote(sourceDir)} -cf - . | tar -C ${shellQuote(workspace)} -xf -`,
  ].join(" && ");
}

function checkoutSourceEnv(
  source: Checkout
): Record<string, string> | undefined {
  return source.kind === "git"
    ? { SOURCE_CONTROL_TOKEN: source.token }
    : undefined;
}

function resolveCwd(cwd: string | undefined): string {
  if (!cwd || cwd === "." || cwd === "./") {
    return WORKSPACE_DIR;
  }

  const normalized = cwd.replace(/\\/g, "/");
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    /(^|\/)\.\.($|\/)/.test(normalized)
  ) {
    throw new Error(`cwd must be inside ${WORKSPACE_DIR}: ${cwd}`);
  }
  return `${WORKSPACE_DIR}/${normalized}`;
}

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 16);
}
