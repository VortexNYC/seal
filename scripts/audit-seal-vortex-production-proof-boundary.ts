#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type RequiredMarker = {
  readonly label: string;
  readonly pattern: RegExp;
};

const repoRoot = resolve(import.meta.dir, "..");
const proofDocRelativePath =
  "docs/test-sessions/session-2026-07-08-seal-vortex-production-go-live.md";
const proofDocArg = parseProofDocArg(process.argv.slice(2));
const proofDocPath = proofDocArg ?? resolve(repoRoot, proofDocRelativePath);
const proofDocForOutput = proofDocArg ?? proofDocRelativePath;

const moneyProofMarkers: readonly RequiredMarker[] = [
  {
    label: "production environment marker",
    pattern: /environment\s*[:=]\s*["']?production["']?/i,
  },
  {
    label: "small production document payment marker",
    pattern: /small production document payment|production document-payment/i,
  },
  {
    label: "settled paid-state proof command",
    pattern: /prove:seal-document-payment-vortex-paid-state[\s\S]*--require-settled/i,
  },
  {
    label: "fully settled evidence",
    pattern: /fullySettled\s*[:=]\s*true/i,
  },
  {
    label: "settlement id evidence",
    pattern:
      /settlementIds?\s*[:=]\s*\[[\s\S]*[a-z0-9_ -]+[\s\S]*\]|settlementId\s*[:=]\s*["'][^"']+["']/i,
  },
  {
    label: "payout visibility evidence",
    pattern:
      /payout visibility|payoutIds?\s*[:=]\s*\[[\s\S]*[a-z0-9_ -]+[\s\S]*\]|payoutId\s*[:=]\s*["'][^"']+["']/i,
  },
];

const postProofRetirementMarkers: readonly RequiredMarker[] = [
  {
    label: "production routing widened after proof",
    pattern:
      /production routing widened\s*[:=]\s*true|document-payment allowlist widened\s*[:=]\s*true/i,
  },
  {
    label: "external production payment-provider residue retired after proof",
    pattern:
      /externalProductionPaymentProviderResidueRetired\s*[:=]\s*true|external production payment-provider residue retired\s*[:=]\s*true/i,
  },
];

const proofDocExists = existsSync(proofDocPath);
const proofDoc = proofDocExists ? readFileSync(proofDocPath, "utf8") : "";
const missingMoneyProofMarkers = proofDocExists ? missingMarkers(proofDoc, moneyProofMarkers) : [];
const missingPostProofRetirementMarkers = proofDocExists
  ? missingMarkers(proofDoc, postProofRetirementMarkers)
  : [];
const productionMoneyProofComplete = proofDocExists && missingMoneyProofMarkers.length === 0;
const postProofRetirementComplete =
  productionMoneyProofComplete && missingPostProofRetirementMarkers.length === 0;
const goLiveProofComplete = productionMoneyProofComplete && postProofRetirementComplete;

if (proofDocExists && !productionMoneyProofComplete) {
  console.log(
    JSON.stringify(
      buildAudit({
        ok: false,
        status: "invalid_production_proof_artifact",
      }),
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    buildAudit({
      ok: true,
      status: goLiveProofComplete
        ? "production_go_live_proven"
        : productionMoneyProofComplete
          ? "waiting_for_post_proof_retirement"
          : "waiting_for_human_production_money_proof",
    }),
    null,
    2,
  ),
);

function missingMarkers(contents: string, markers: readonly RequiredMarker[]): readonly string[] {
  return markers.filter((marker) => !marker.pattern.test(contents)).map((marker) => marker.label);
}

function buildAudit(input: { readonly ok: boolean; readonly status: string }) {
  return {
    ok: input.ok,
    check: "seal_vortex_production_proof_boundary",
    boundary:
      "Static production proof audit only. It reads a checked-in proof note if present and never calls Convex, Finix, card payment, settlement reconciliation, payout, production config, or webhook retirement.",
    proofDoc: proofDocForOutput,
    proofDocExists,
    productionMoneyProofComplete,
    postProofRetirementComplete,
    goLiveProofComplete,
    status: input.status,
    missingMoneyProofMarkers,
    missingPostProofRetirementMarkers,
    requiredBeforeLaunch: [
      "Configure production Vortex/Finix and Seal document-payment routing.",
      "Run one small production document payment against the explicitly allowlisted organization.",
      "Confirm production settlement and payout visibility.",
      "Run the paid-state proof with production ids and --require-settled.",
      "Only after proof passes, widen production routing and retire external production payment-provider residue.",
      `Record the evidence in ${proofDocForOutput}.`,
    ],
  };
}

function parseProofDocArg(args: readonly string[]): string | undefined {
  if (args.length === 0) {
    return undefined;
  }
  if (args.length !== 2 || args[0] !== "--proof-doc" || args[1].length === 0) {
    console.error("Usage: audit-seal-vortex-production-proof-boundary.ts [--proof-doc <path>]");
    process.exit(1);
  }
  return resolve(args[1]);
}
