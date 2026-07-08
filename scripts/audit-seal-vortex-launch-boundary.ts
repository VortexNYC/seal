#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

type GroupAudit = {
  readonly label: string;
  readonly present: readonly string[];
  readonly missing: readonly string[];
  readonly invalid: readonly string[];
};

type DeploymentAudit = {
  readonly ok: boolean;
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

type ProductionReadinessAudit = {
  readonly ok: boolean;
  readonly check: string;
  readonly boundary: string;
  readonly seal: DeploymentAudit;
  readonly vortex: DeploymentAudit;
  readonly remediation: {
    readonly boundary: string;
    readonly missingEnvSetCommands: readonly RemediationCommand[];
    readonly proofSequence: readonly string[];
  };
  readonly nextAction: string;
};

type HostedOutcomeAudit = {
  readonly ok: boolean;
  readonly check: string;
  readonly settlement: {
    readonly fullySettledEvidence: boolean;
    readonly status: string;
    readonly requiredBeforeLaunch: string;
  };
};

type SandboxSettlementAudit = {
  readonly ok: boolean;
  readonly check: string;
  readonly readinessWindow: "elapsed" | "waiting";
  readonly captured: {
    readonly merchantAccountId: string;
    readonly vortexPayableId: string;
    readonly hostedInvoiceUrl: string;
    readonly paymentId: string;
    readonly readyToSettleAt: string;
  };
};

const repoRoot = new URL("..", import.meta.url).pathname;

const knownProductionConfigBlockers = new Set([
  "VORTEX_BILLING_PAYMENTS_ENVIRONMENT",
  "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS",
  "VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP",
  "VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP",
  "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP",
  "VORTEX_BILLING_DOCUMENT_PRICE_MAP",
  "VORTEX_PAYMENTS_RUNTIME_MODE",
  "FINIX_PRODUCTION_USERNAME",
  "FINIX_PRODUCTION_PASSWORD",
  "FINIX_PRODUCTION_APPLICATION_ID",
  "FINIX_PRODUCTION_WEBHOOK_SECRET",
]);

const sandbox = runJsonScript<SandboxSettlementAudit>({
  label: "sandbox settlement boundary",
  scriptPath: "scripts/audit-seal-vortex-sandbox-settlement-boundary.ts",
  allowedStatuses: new Set([0]),
  isExpectedShape: isSandboxSettlementAudit,
});

const hostedOutcomes = runJsonScript<HostedOutcomeAudit>({
  label: "hosted outcomes boundary",
  scriptPath: "scripts/audit-seal-vortex-hosted-outcomes-boundary.ts",
  allowedStatuses: new Set([0]),
  isExpectedShape: isHostedOutcomeAudit,
});

const production = runJsonScript<ProductionReadinessAudit>({
  label: "production readiness boundary",
  scriptPath: "scripts/audit-seal-vortex-production-readiness.ts",
  allowedStatuses: new Set([0, 1]),
  isExpectedShape: isProductionReadinessAudit,
});

const missingProductionNames = collectMissingNames(production);
const invalidProductionNames = collectInvalidNames(production);
const unexpectedMissingNames = missingProductionNames.filter(
  (name) => !knownProductionConfigBlockers.has(name),
);

if (invalidProductionNames.length > 0) {
  fail(`Production readiness has invalid present values: ${invalidProductionNames.join(", ")}`);
}

if (unexpectedMissingNames.length > 0) {
  fail(`Production readiness has unexpected missing values: ${unexpectedMissingNames.join(", ")}`);
}

const remediationLabels = new Set(
  production.remediation.missingEnvSetCommands.map((command) => command.label),
);
const missingCommands = missingProductionNames.filter((name) => !remediationLabels.has(name));

if (missingCommands.length > 0) {
  fail(`Production readiness remediation omits missing values: ${missingCommands.join(", ")}`);
}

if (!production.ok && missingProductionNames.length === 0) {
  fail("Production readiness failed without reporting missing production names.");
}

const productionBoundary = production.ok
  ? "ready_for_human_production_proof"
  : "waiting_for_known_production_config";
const waitingOn = [
  ...(hostedOutcomes.settlement.fullySettledEvidence ? [] : ["human_settlement_proof"]),
  ...(production.ok ? [] : ["production_config"]),
] as const;
const launchReady = waitingOn.length === 0;

console.log(
  JSON.stringify(
    {
      ok: true,
      check: "seal_vortex_launch_boundary",
      launchReady,
      boundary:
        "Non-mutating launch boundary audit. It proves sandbox settlement handoff is preserved, hosted outcomes are projected, and production readiness is either green or blocked only by known human-run configuration names.",
      waitingOn,
      hostedOutcomes: {
        ok: hostedOutcomes.ok,
        settlement: hostedOutcomes.settlement,
      },
      sandbox: {
        ok: sandbox.ok,
        readinessWindow: sandbox.readinessWindow,
        captured: sandbox.captured,
      },
      production: {
        ok: production.ok,
        boundary: productionBoundary,
        missingKnownConfig: missingProductionNames,
        invalidPresentConfig: invalidProductionNames,
        remediationCommandCount: production.remediation.missingEnvSetCommands.length,
      },
      nextAction: getNextAction({
        launchReady,
        needsSettlementProof: !hostedOutcomes.settlement.fullySettledEvidence,
        needsProductionConfig: !production.ok,
      }),
    },
    null,
    2,
  ),
);

function runJsonScript<T>(input: {
  readonly label: string;
  readonly scriptPath: string;
  readonly allowedStatuses: ReadonlySet<number>;
  readonly isExpectedShape: (value: unknown) => value is T;
}): T {
  const result = spawnSync("bun", ["run", input.scriptPath], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });

  if (result.error !== undefined) {
    fail(`Failed to start ${input.label}: ${result.error.message}`);
  }

  const status = result.status ?? 1;
  if (!input.allowedStatuses.has(status)) {
    fail(`${input.label} exited ${status}: ${result.stderr || result.stdout}`);
  }

  const parsed = parseJsonFromOutput(result.stdout, input.label);
  if (!input.isExpectedShape(parsed)) {
    fail(`${input.label} returned an unexpected JSON shape.`);
  }
  return parsed;
}

function parseJsonFromOutput(output: string, label: string): unknown {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    fail(`${label} did not print JSON.`);
  }
  try {
    return JSON.parse(output.slice(start, end + 1)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${label} printed invalid JSON: ${message}`);
  }
}

function collectMissingNames(audit: ProductionReadinessAudit): readonly string[] {
  return unique([
    ...audit.seal.groups.flatMap((group) => group.missing),
    ...audit.vortex.groups.flatMap((group) => group.missing),
  ]);
}

function collectInvalidNames(audit: ProductionReadinessAudit): readonly string[] {
  return unique([
    ...audit.seal.groups.flatMap((group) => group.invalid),
    ...audit.vortex.groups.flatMap((group) => group.invalid),
  ]);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function isProductionReadinessAudit(value: unknown): value is ProductionReadinessAudit {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.ok === "boolean" &&
    value.check === "seal_vortex_production_readiness_config" &&
    typeof value.boundary === "string" &&
    isDeploymentAudit(value.seal) &&
    isDeploymentAudit(value.vortex) &&
    isRecord(value.remediation) &&
    Array.isArray(value.remediation.missingEnvSetCommands) &&
    Array.isArray(value.remediation.proofSequence) &&
    typeof value.nextAction === "string"
  );
}

function isHostedOutcomeAudit(value: unknown): value is HostedOutcomeAudit {
  if (!isRecord(value) || !isRecord(value.settlement)) {
    return false;
  }
  return (
    value.ok === true &&
    value.check === "seal_vortex_hosted_outcomes_boundary" &&
    typeof value.settlement.fullySettledEvidence === "boolean" &&
    typeof value.settlement.status === "string" &&
    typeof value.settlement.requiredBeforeLaunch === "string"
  );
}

function isSandboxSettlementAudit(value: unknown): value is SandboxSettlementAudit {
  if (!isRecord(value) || !isRecord(value.captured)) {
    return false;
  }
  return (
    value.ok === true &&
    value.check === "seal_vortex_sandbox_settlement_boundary" &&
    (value.readinessWindow === "elapsed" || value.readinessWindow === "waiting") &&
    typeof value.captured.merchantAccountId === "string" &&
    typeof value.captured.vortexPayableId === "string" &&
    typeof value.captured.hostedInvoiceUrl === "string" &&
    typeof value.captured.paymentId === "string" &&
    typeof value.captured.readyToSettleAt === "string"
  );
}

function isDeploymentAudit(value: unknown): value is DeploymentAudit {
  if (!isRecord(value) || !Array.isArray(value.groups)) {
    return false;
  }
  return (
    typeof value.ok === "boolean" &&
    typeof value.repoRoot === "string" &&
    typeof value.deployment === "string" &&
    value.groups.every(isGroupAudit)
  );
}

function isGroupAudit(value: unknown): value is GroupAudit {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.label === "string" &&
    isStringArray(value.present) &&
    isStringArray(value.missing) &&
    isStringArray(value.invalid)
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNextAction(input: {
  readonly launchReady: boolean;
  readonly needsSettlementProof: boolean;
  readonly needsProductionConfig: boolean;
}): string {
  if (input.launchReady) {
    return "Human runs the production proof sequence with explicit target ids.";
  }
  if (input.needsSettlementProof && input.needsProductionConfig) {
    return "Human completes sandbox settlement proof and configures the listed production environment names, then reruns production readiness and live proof.";
  }
  if (input.needsSettlementProof) {
    return "Human completes sandbox settlement proof, then reruns the launch boundary audit.";
  }
  return "Human configures the listed production environment names, then reruns production readiness and live proof.";
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
