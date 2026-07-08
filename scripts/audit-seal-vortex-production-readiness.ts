#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { resolve } from "node:path";

type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

type AuditGroup = {
  readonly label: string;
  readonly requiredEnvNames: readonly string[];
};

type GroupAudit = {
  readonly label: string;
  readonly present: readonly string[];
  readonly missing: readonly string[];
  readonly invalid: readonly string[];
};

type DeploymentAudit =
  | {
      readonly ok: true;
      readonly repoRoot: string;
      readonly deployment: string;
      readonly groups: readonly GroupAudit[];
    }
  | {
      readonly ok: false;
      readonly repoRoot: string;
      readonly deployment: string;
      readonly groups: readonly GroupAudit[];
      readonly errors?: readonly string[];
    };

type RemediationCommand = {
  readonly label: string;
  readonly cwd: string;
  readonly command: string;
};

type RemediationPlan = {
  readonly boundary: string;
  readonly missingEnvSetCommands: readonly RemediationCommand[];
  readonly proofSequence: readonly string[];
};

const repoRoot = resolve(import.meta.dir, "..");
const sealBackendRoot = resolve(repoRoot, "apps/backend");
const localVortexRepoRoot =
  readOptionalEnv("VORTEX_PAYMENTS_REPO_ROOT") ?? resolve(repoRoot, "../vortex-payments");
const vortexBackendRoot = resolve(localVortexRepoRoot, "apps/backend");

const sealProductionDeployment =
  process.env.SEAL_PRODUCTION_CONVEX_DEPLOYMENT ?? "compassionate-robin-742";
const vortexProductionDeployment =
  process.env.VORTEX_PRODUCTION_CONVEX_DEPLOYMENT ?? "quixotic-snake-887";

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? resolve(value) : undefined;
}

const sealGroups: readonly AuditGroup[] = [
  {
    label: "Seal Vortex API and webhooks",
    requiredEnvNames: [
      "VORTEX_BILLING_API_BASE_URL",
      "VORTEX_BILLING_API_KEY",
      "VORTEX_BILLING_WEBHOOK_SECRET",
      "VORTEX_BILLING_PAYMENTS_ENVIRONMENT",
    ],
  },
  {
    label: "Seal SaaS billing routing",
    requiredEnvNames: [
      "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
      "VORTEX_BILLING_ACCOUNT_MAP",
      "VORTEX_BILLING_SAAS_PRICE_MAP",
    ],
  },
  {
    label: "Seal document-payment routing",
    requiredEnvNames: [
      "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS",
      "VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP",
      "VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP",
      "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP",
      "VORTEX_BILLING_DOCUMENT_PRICE_MAP",
    ],
  },
];

const vortexGroups: readonly AuditGroup[] = [
  {
    label: "Vortex production public API",
    requiredEnvNames: [
      "VORTEX_BILLING_SERVICE_API_KEY",
      "VORTEX_PAYMENTS_PROVIDER",
      "VORTEX_PAYMENTS_RUNTIME_MODE",
    ],
  },
  {
    label: "Vortex production Finix runtime",
    requiredEnvNames: [
      "FINIX_PRODUCTION_USERNAME",
      "FINIX_PRODUCTION_PASSWORD",
      "FINIX_PRODUCTION_APPLICATION_ID",
      "FINIX_PRODUCTION_WEBHOOK_SECRET",
    ],
  },
];

const humanValuePlaceholders: Readonly<Record<string, string>> = {
  VORTEX_BILLING_PAYMENTS_ENVIRONMENT: "production",
  VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: "'[\"<seal-production-org-id>\"]'",
  VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP:
    '\'{"<seal-production-org-id>":"<vortex-production-billing-account-id>"}\'',
  VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP:
    '\'{"<seal-production-org-id>":"<vortex-production-customer-id>"}\'',
  VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP:
    '\'{"<seal-production-org-id>":"<vortex-production-merchant-account-id>"}\'',
  VORTEX_BILLING_DOCUMENT_PRICE_MAP:
    '\'{"<seal-production-org-id>":"<vortex-production-document-price-id>"}\'',
  VORTEX_PAYMENTS_RUNTIME_MODE: "finix",
  FINIX_PRODUCTION_USERNAME: "'<1password-finix-production-username>'",
  FINIX_PRODUCTION_PASSWORD: "'<1password-finix-production-password>'",
  FINIX_PRODUCTION_APPLICATION_ID: "'<finix-production-application-id>'",
  FINIX_PRODUCTION_WEBHOOK_SECRET: "'<finix-production-webhook-secret>'",
};

type EnvAuditResult =
  | { readonly present: true; readonly value: string }
  | { readonly present: false; readonly error?: string };

type EnvValidator = (value: string) => string | null;

const envValidators: Readonly<Record<string, EnvValidator>> = {
  VORTEX_BILLING_API_BASE_URL: validateHttpsUrl,
  VORTEX_BILLING_PAYMENTS_ENVIRONMENT: mustEqual("production"),
  VORTEX_BILLING_SAAS_ORGANIZATION_IDS: validateStringArrayOrWildcard,
  VORTEX_BILLING_ACCOUNT_MAP: validateStringMap,
  VORTEX_BILLING_SAAS_PRICE_MAP: validateStringMap,
  VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: validateStringArray,
  VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP: validateStringMap,
  VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP: validateStringMap,
  VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP: validateStringMap,
  VORTEX_BILLING_DOCUMENT_PRICE_MAP: validateStringMap,
  VORTEX_PAYMENTS_PROVIDER: mustEqual("finix"),
  VORTEX_PAYMENTS_RUNTIME_MODE: mustEqual("finix"),
};

async function runCommand(cmd: readonly string[], cwd: string): Promise<CommandResult> {
  const child = Bun.spawn({
    cmd: [...cmd],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

function envValueWasMissing(result: CommandResult, name: string): boolean {
  const output = `${result.stdout}\n${result.stderr}`;
  return (
    output.includes(`Environment variable "${name}" not found`) ||
    output.includes(`Environment variable ${name} not found`)
  );
}

async function getEnvValue(input: {
  readonly repoRoot: string;
  readonly deployment: string;
  readonly name: string;
}): Promise<EnvAuditResult> {
  const result = await runCommand(
    ["bunx", "convex", "env", "get", input.name, "--prod", "--deployment", input.deployment],
    input.repoRoot,
  );
  if (envValueWasMissing(result, input.name)) {
    return { present: false };
  }
  if (result.exitCode !== 0) {
    return {
      present: false,
      error: `convex env get failed for ${input.name}: ${result.stderr || result.stdout}`,
    };
  }
  return result.stdout.length > 0 ? { present: true, value: result.stdout } : { present: false };
}

async function auditGroups(input: {
  readonly repoRoot: string;
  readonly deployment: string;
  readonly groups: readonly AuditGroup[];
}): Promise<{ readonly groups: readonly GroupAudit[]; readonly errors: readonly string[] }> {
  const auditedGroups: GroupAudit[] = [];
  const errors: string[] = [];

  for (const group of input.groups) {
    const present: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const name of group.requiredEnvNames) {
      const result = await getEnvValue({
        repoRoot: input.repoRoot,
        deployment: input.deployment,
        name,
      });
      if (result.present) {
        present.push(name);
        const validationError = envValidators[name]?.(result.value) ?? null;
        if (validationError !== null) {
          invalid.push(name);
          errors.push(`${name}: ${validationError}`);
        }
      } else {
        missing.push(name);
      }
      if ("error" in result) {
        errors.push(result.error);
      }
    }

    auditedGroups.push({
      label: group.label,
      present,
      missing,
      invalid,
    });
  }

  return { groups: auditedGroups, errors };
}

async function auditDeployment(input: {
  readonly repoRoot: string;
  readonly deployment: string;
  readonly groups: readonly AuditGroup[];
}): Promise<DeploymentAudit> {
  if (!existsSync(input.repoRoot)) {
    return {
      ok: false,
      repoRoot: input.repoRoot,
      deployment: input.deployment,
      groups: input.groups.map((group) => ({
        label: group.label,
        present: [],
        missing: group.requiredEnvNames,
        invalid: [],
      })),
      errors: ["repo root missing"],
    };
  }

  const audit = await auditGroups({
    repoRoot: input.repoRoot,
    deployment: input.deployment,
    groups: input.groups,
  });
  const ok =
    audit.errors.length === 0 &&
    audit.groups.every((group) => group.missing.length === 0 && group.invalid.length === 0);
  return ok
    ? {
        ok: true,
        repoRoot: input.repoRoot,
        deployment: input.deployment,
        groups: audit.groups,
      }
    : {
        ok: false,
        repoRoot: input.repoRoot,
        deployment: input.deployment,
        groups: audit.groups,
        ...(audit.errors.length > 0 ? { errors: audit.errors } : {}),
      };
}

function collectMissingEnvNames(audit: DeploymentAudit): readonly string[] {
  return [...new Set(audit.groups.flatMap((group) => group.missing))];
}

function buildEnvSetCommand(input: {
  readonly repoRoot: string;
  readonly deployment: string;
  readonly name: string;
}): RemediationCommand {
  return {
    label: input.name,
    cwd: input.repoRoot,
    command: [
      "bunx",
      "convex",
      "env",
      "set",
      input.name,
      humanValuePlaceholders[input.name] ?? "'<value>'",
      "--prod",
      "--deployment",
      input.deployment,
    ].join(" "),
  };
}

function buildRemediationPlan(input: {
  readonly seal: DeploymentAudit;
  readonly vortex: DeploymentAudit;
}): RemediationPlan {
  const missingEnvSetCommands = [
    ...collectMissingEnvNames(input.seal).map((name) =>
      buildEnvSetCommand({
        repoRoot: input.seal.repoRoot,
        deployment: input.seal.deployment,
        name,
      }),
    ),
    ...collectMissingEnvNames(input.vortex).map((name) =>
      buildEnvSetCommand({
        repoRoot: input.vortex.repoRoot,
        deployment: input.vortex.deployment,
        name,
      }),
    ),
  ];

  return {
    boundary:
      "Human-run checklist only. These commands are printed for the operator; this audit never sets env values, creates payments, reconciles settlement, or moves money.",
    missingEnvSetCommands,
    proofSequence: [
      "bun run audit:seal-vortex-production-readiness",
      "Human runs one small production document payment against the explicitly allowlisted organization.",
      "Human waits for production settlement and payout visibility.",
      "Human reruns the paid-state proof with production ids and --require-settled.",
      "Only after proof passes: widen document-payment routing and retire external production webhook residue.",
    ],
  };
}

const seal = await auditDeployment({
  repoRoot: sealBackendRoot,
  deployment: sealProductionDeployment,
  groups: sealGroups,
});
const vortex = await auditDeployment({
  repoRoot: vortexBackendRoot,
  deployment: vortexProductionDeployment,
  groups: vortexGroups,
});

const ok = seal.ok && vortex.ok;

console.log(
  JSON.stringify(
    {
      ok,
      check: "seal_vortex_production_readiness_config",
      boundary:
        "Presence and shape audit. It lists required environment variable names and validation failures but never prints secret values or mutates deployments.",
      seal,
      vortex,
      remediation: buildRemediationPlan({ seal, vortex }),
      nextAction: ok
        ? "Run the human production proof sequence with explicit target ids."
        : "Configure the missing or invalid production environment names, then rerun this readiness audit.",
    },
    null,
    2,
  ),
);

if (!ok) {
  process.exit(1);
}

function mustEqual(expected: string): EnvValidator {
  return (value) => (value === expected ? null : `expected ${expected}`);
}

function validateHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? null : "expected https URL";
  } catch {
    return "expected valid URL";
  }
}

function validateStringArray(value: string): string | null {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) {
    return "expected JSON string array";
  }
  if (parsed.length === 0) {
    return "expected at least one entry";
  }
  return parsed.every((entry) => typeof entry === "string" && entry.length > 0)
    ? null
    : "expected non-empty string entries";
}

function validateStringArrayOrWildcard(value: string): string | null {
  return value === "*" ? null : validateStringArray(value);
}

function validateStringMap(value: string): string | null {
  const parsed = parseJson(value);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "expected JSON object";
  }
  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    return "expected at least one entry";
  }
  return entries.every(
    ([key, entry]) => key.length > 0 && typeof entry === "string" && entry.length > 0,
  )
    ? null
    : "expected non-empty string keys and values";
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
