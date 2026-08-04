#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ProductionProofBoundaryAudit = {
  readonly ok: boolean;
  readonly check: string;
  readonly proofDocExists: boolean;
  readonly productionMoneyProofComplete: boolean;
  readonly postProofRetirementComplete: boolean;
  readonly goLiveProofComplete: boolean;
  readonly status: string;
  readonly missingMoneyProofMarkers: readonly string[];
  readonly missingPostProofRetirementMarkers: readonly string[];
};

const repoRoot = new URL("..", import.meta.url).pathname;
const tempDir = mkdtempSync(join(tmpdir(), "seal-production-proof-boundary-"));

const productionMoneyProofOnlyFixture = `
environment: production

small production document payment captured for the explicitly allowlisted organization.

\`\`\`bash
bun run prove:seal-document-payment-vortex-paid-state -- \\
  --vortex-payable-id payable_prod_example \\
  --hosted-invoice-url https://payments.vortex.example/pay/example \\
  --require-settled
\`\`\`

fullySettled: true
settlementIds: ["settlement_prod_example"]
payout visibility confirmed.
payoutIds: ["payout_prod_example"]
`;

const postProofRetirementFixture = `
production routing widened: true
external production payment-provider residue retired: true
`;

try {
  const missing = runAudit(join(tempDir, "missing.md"));
  assertEqual(missing.status, 0, "missing proof doc exits 0");
  assertAudit(missing.audit, {
    proofDocExists: false,
    productionMoneyProofComplete: false,
    postProofRetirementComplete: false,
    goLiveProofComplete: false,
    status: "waiting_for_production_money_proof",
  });

  const incompletePath = join(tempDir, "incomplete.md");
  writeFileSync(incompletePath, "environment: production\n", "utf8");
  const incomplete = runAudit(incompletePath);
  assertEqual(incomplete.status, 1, "incomplete proof doc exits 1");
  assertEqual(
    incomplete.audit.ok,
    false,
    "incomplete proof doc reports ok false"
  );
  assertEqual(
    incomplete.audit.status,
    "invalid_production_proof_artifact",
    "incomplete proof doc reports invalid status"
  );
  assert(
    incomplete.audit.missingMoneyProofMarkers.length > 0,
    "incomplete proof doc lists missing markers"
  );

  const moneyOnlyPath = join(tempDir, "money-only.md");
  writeFileSync(moneyOnlyPath, productionMoneyProofOnlyFixture, "utf8");
  const moneyOnly = runAudit(moneyOnlyPath);
  assertEqual(moneyOnly.status, 0, "money-proof-only doc exits 0");
  assertAudit(moneyOnly.audit, {
    proofDocExists: true,
    productionMoneyProofComplete: true,
    postProofRetirementComplete: false,
    goLiveProofComplete: false,
    status: "waiting_for_post_proof_retirement",
  });
  assert(
    moneyOnly.audit.missingPostProofRetirementMarkers.length > 0,
    "money-proof-only doc lists post-proof retirement markers"
  );

  const completePath = join(tempDir, "complete.md");
  writeFileSync(
    completePath,
    `${productionMoneyProofOnlyFixture}\n${postProofRetirementFixture}`,
    "utf8"
  );
  const complete = runAudit(completePath);
  assertEqual(complete.status, 0, "complete proof doc exits 0");
  assertAudit(complete.audit, {
    proofDocExists: true,
    productionMoneyProofComplete: true,
    postProofRetirementComplete: true,
    goLiveProofComplete: true,
    status: "production_go_live_proven",
  });

  console.log("Seal Vortex production proof boundary self-proof passed:");
  console.log(
    "- missing proof artifact keeps launch proof incomplete without failing local audits"
  );
  console.log("- incomplete proof artifact fails closed");
  console.log(
    "- production money proof alone waits for post-proof retirement evidence"
  );
  console.log(
    "- full money proof plus retirement evidence proves go-live boundary"
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runAudit(proofDoc: string): {
  readonly status: number;
  readonly audit: ProductionProofBoundaryAudit;
} {
  const result = spawnSync(
    "bun",
    [
      "run",
      "scripts/audit-seal-vortex-production-proof-boundary.ts",
      "--proof-doc",
      proofDoc,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (result.error !== undefined) {
    throw new Error(
      `Failed to start production proof boundary audit: ${result.error.message}`
    );
  }
  const audit = parseAudit(result.stdout);
  return {
    status: result.status ?? 1,
    audit,
  };
}

function parseAudit(output: string): ProductionProofBoundaryAudit {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Audit did not print JSON:\n${output}`);
  }
  const parsed = JSON.parse(output.slice(start, end + 1)) as unknown;
  if (!isAudit(parsed)) {
    throw new Error("Audit returned unexpected JSON shape.");
  }
  return parsed;
}

function isAudit(value: unknown): value is ProductionProofBoundaryAudit {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.ok === "boolean" &&
    record.check === "seal_vortex_production_proof_boundary" &&
    typeof record.proofDocExists === "boolean" &&
    typeof record.productionMoneyProofComplete === "boolean" &&
    typeof record.postProofRetirementComplete === "boolean" &&
    typeof record.goLiveProofComplete === "boolean" &&
    typeof record.status === "string" &&
    isStringArray(record.missingMoneyProofMarkers) &&
    isStringArray(record.missingPostProofRetirementMarkers)
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function assertAudit(
  audit: ProductionProofBoundaryAudit,
  expected: {
    readonly proofDocExists: boolean;
    readonly productionMoneyProofComplete: boolean;
    readonly postProofRetirementComplete: boolean;
    readonly goLiveProofComplete: boolean;
    readonly status: string;
  }
): void {
  assertEqual(audit.ok, true, `${expected.status} reports ok true`);
  assertEqual(
    audit.proofDocExists,
    expected.proofDocExists,
    `${expected.status} proofDocExists`
  );
  assertEqual(
    audit.productionMoneyProofComplete,
    expected.productionMoneyProofComplete,
    `${expected.status} productionMoneyProofComplete`
  );
  assertEqual(
    audit.postProofRetirementComplete,
    expected.postProofRetirementComplete,
    `${expected.status} postProofRetirementComplete`
  );
  assertEqual(
    audit.goLiveProofComplete,
    expected.goLiveProofComplete,
    `${expected.status} goLiveProofComplete`
  );
  assertEqual(audit.status, expected.status, `${expected.status} status`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}`
    );
  }
}

function assert(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(label);
  }
}
