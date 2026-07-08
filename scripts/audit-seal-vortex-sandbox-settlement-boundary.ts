#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type CapturedProof = {
  readonly merchantAccountId: string;
  readonly vortexPayableId: string;
  readonly hostedInvoiceUrl: string;
  readonly paymentId: string;
  readonly readyToSettleAt: string;
};

const repoRoot = new URL("..", import.meta.url).pathname;
const localVortexRepoRoot = join(repoRoot, "../vortex-payments");
const proofDocPath = join(
  repoRoot,
  "docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md",
);
const finalGateScriptPath = join(
  localVortexRepoRoot,
  "scripts/prove-seal-vortex-final-sandbox-launch-gate.ts",
);
const finalGateDocPath = join(
  localVortexRepoRoot,
  "docs/test-sessions/session-2026-07-07-seal-vortex-final-sandbox-launch-gate.md",
);
const proofDoc = readFileSync(proofDocPath, "utf8");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readRequiredMatch(pattern: RegExp, label: string): string {
  const match = proofDoc.match(pattern);
  const value = match?.[1];
  if (value === undefined || value.length === 0) {
    fail(`Missing ${label} in ${proofDocPath}`);
  }
  return value;
}

function assertContains(fragment: string, label: string): void {
  if (!proofDoc.includes(fragment)) {
    fail(`Missing ${label} in ${proofDocPath}`);
  }
}

function assertFileContains(path: string, fragment: string, label: string): void {
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
  }
  const contents = readFileSync(path, "utf8");
  if (!contents.includes(fragment)) {
    fail(`Missing ${label} fragment in ${path}: ${fragment}`);
  }
}

const captured: CapturedProof = {
  merchantAccountId: readRequiredMatch(/^merchantAccountId:\s*(\S+)$/m, "merchant account id"),
  vortexPayableId: readRequiredMatch(/^vortexPayableId:\s*(\S+)$/m, "Vortex payable id"),
  hostedInvoiceUrl: readRequiredMatch(/^hostedInvoiceUrl:\s*(\S+)$/m, "hosted invoice URL"),
  paymentId: readRequiredMatch(/^paymentId:\s*(\S+)$/m, "payment id"),
  readyToSettleAt: readRequiredMatch(/"readyToSettleAt":\s*"([^"]+)"/, "ready-to-settle timestamp"),
};

assertContains("--require-settled", "settled paid-state proof flag");
assertContains("--reconcile-if-ready", "human-run settlement reconciliation flag");
assertContains("waiting_for_provider_ready_to_settle", "provider settlement readiness state");

assertFileContains(
  finalGateScriptPath,
  "inspect:vortex-payment-settlement-readiness",
  "Vortex final sandbox launch gate settlement step",
);
assertFileContains(
  finalGateScriptPath,
  "prove:seal-document-payment-vortex-paid-state",
  "Vortex final sandbox launch gate Seal proof step",
);
assertFileContains(finalGateScriptPath, "--reconcile-if-ready", "Vortex final sandbox launch gate reconcile flag");
assertFileContains(finalGateScriptPath, "--require-settled", "Vortex final sandbox launch gate settled flag");

for (const [label, value] of Object.entries({
  paymentId: captured.paymentId,
  merchantAccountId: captured.merchantAccountId,
  vortexPayableId: captured.vortexPayableId,
  hostedInvoiceUrl: captured.hostedInvoiceUrl,
  readyToSettleAt: captured.readyToSettleAt,
})) {
  assertFileContains(finalGateDocPath, value, `Vortex final sandbox launch gate ${label}`);
}

const readyToSettleDate = new Date(captured.readyToSettleAt);
if (Number.isNaN(readyToSettleDate.getTime())) {
  fail(`Invalid readyToSettleAt timestamp: ${captured.readyToSettleAt}`);
}

const now = new Date();
const readinessWindow = now.getTime() >= readyToSettleDate.getTime() ? "elapsed" : "waiting";

const vortexDeployment = "dev:notable-leopard-969";
const sealDeployment = "dev:clever-goose-484";
const vortexHumanRepoRoot = "/home/debian/Projects/vortex-payments";
const sealHumanRepoRoot = "/home/debian/Projects/Seal";

const inspectWithoutReconcileCommand = [
  `cd ${vortexHumanRepoRoot}`,
  `CONVEX_DEPLOYMENT=${vortexDeployment} \\`,
  "bun run inspect:vortex-payment-settlement-readiness -- \\",
  "  --environment sandbox \\",
  `  --payment-id ${captured.paymentId} \\`,
  `  --expected-merchant-account-id ${captured.merchantAccountId}`,
].join("\n");

const humanReconcileCommand = `${inspectWithoutReconcileCommand} \\
  --reconcile-if-ready`;

const settledPaidStateProofCommand = [
  `cd ${sealHumanRepoRoot}`,
  `SEAL_CONVEX_DEPLOYMENT=${sealDeployment} \\`,
  `VORTEX_CONVEX_DEPLOYMENT=${vortexDeployment} \\`,
  "bun run prove:seal-document-payment-vortex-paid-state -- \\",
  `  --vortex-payable-id ${captured.vortexPayableId} \\`,
  `  --hosted-invoice-url ${captured.hostedInvoiceUrl} \\`,
  "  --require-settled",
].join("\n");

const finalSandboxLaunchGateCommand = [
  `cd ${vortexHumanRepoRoot}`,
  `SEAL_REPO_ROOT=${sealHumanRepoRoot} \\`,
  "bun run prove:seal-vortex-final-sandbox-launch-gate",
].join("\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      check: "seal_vortex_sandbox_settlement_boundary",
      boundary:
        "Static handoff audit only. It reads the checked-in proof note, preserves the sandbox ids, and prints commands; it never calls Convex, Finix, settlement reconciliation, payout flows, or live card payment.",
      proofDoc: proofDocPath,
      captured,
      readinessWindow,
      commands: {
        finalSandboxLaunchGate: finalSandboxLaunchGateCommand,
        inspectWithoutReconcile: inspectWithoutReconcileCommand,
        humanReconcileIfReady: humanReconcileCommand,
        settledPaidStateProof: settledPaidStateProofCommand,
      },
      nextAction:
        "Human runs the reconciliation command only after provider readiness, then runs the settled paid-state proof and records fullySettled evidence.",
    },
    null,
    2,
  ),
);
