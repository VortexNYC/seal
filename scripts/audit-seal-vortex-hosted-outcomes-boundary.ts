#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const proofDocPath = join(
  repoRoot,
  "docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md",
);
const proofDoc = readFileSync(proofDocPath, "utf8");

type RequiredFragment = {
  readonly label: string;
  readonly fragment: string;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertContains(required: RequiredFragment): void {
  if (!proofDoc.includes(required.fragment)) {
    fail(`Missing ${required.label} in ${proofDocPath}`);
  }
}

const paidOutcomeFragments: readonly RequiredFragment[] = [
  {
    label: "active Vortex payable id",
    fragment: "vortexPayableId: payable_mray9uu0_58xe8f37",
  },
  {
    label: "active hosted invoice URL",
    fragment:
      "hostedInvoiceUrl: https://notable-leopard-969.convex.site/pay/pay_8j0wUAe2iDThLirDfGeN1IDCBkh2yauaJr0CKRuBCws",
  },
  {
    label: "captured Vortex payment id",
    fragment: "paymentId: pay_mrayujpd_uha1hffh",
  },
  {
    label: "paid-state proof command",
    fragment: "bun run prove:seal-document-payment-vortex-paid-state --",
  },
  {
    label: "Seal paid payment status",
    fragment: '"paymentStatus": "paid"',
  },
  {
    label: "Seal paid invoice status",
    fragment: '"invoiceStatus": "paid"',
  },
  {
    label: "Vortex invoice provider",
    fragment: '"invoiceProvider": "vortex_billing"',
  },
  {
    label: "completed document workflow status",
    fragment: '"documentWorkflowStatus": "completed"',
  },
  {
    label: "captured Vortex payment status",
    fragment: '"vortexPaymentStatus": "captured"',
  },
] as const;

const failedRecoveryFragments: readonly RequiredFragment[] = [
  {
    label: "failed-payment recovery command",
    fragment: "bun run prove:seal-vortex-failed-payment-recovery-cloud",
  },
  {
    label: "failed-payment recovery proof name",
    fragment: '"proof": "seal-vortex-failed-payment-recovery-cloud"',
  },
  {
    label: "duplicate failed event idempotency",
    fragment: '"duplicateFailedSkipped": true',
  },
  {
    label: "stale failed event ignored after paid",
    fragment: '"staleFailedIgnoredAfterPaid": true',
  },
  {
    label: "failed invoice uncollectible projection",
    fragment: '"failedInvoiceStatus": "uncollectible"',
  },
  {
    label: "failed invoice dunning projection",
    fragment: '"failedDunningStatus": "active"',
  },
  {
    label: "later paid recovery projection",
    fragment: '"finalPaymentStatus": "paid"',
  },
  {
    label: "later paid workflow completion",
    fragment: '"finalDocumentWorkflowStatus": "completed"',
  },
  {
    label: "later paid invoice projection",
    fragment: '"finalInvoiceStatus": "paid"',
  },
  {
    label: "dunning cancellation after paid",
    fragment: '"finalDunningStatus": "cancelled"',
  },
] as const;

const launchBoundaryFragments: readonly RequiredFragment[] = [
  {
    label: "settlement readiness timestamp",
    fragment: '"readyToSettleAt": "2026-07-08T18:12:06.10Z"',
  },
  {
    label: "provider settlement wait state",
    fragment: '"status": "waiting_for_provider_ready_to_settle"',
  },
  {
    label: "hard settled proof flag",
    fragment: "--require-settled",
  },
  {
    label: "reconcile-if-ready flag",
    fragment: "--reconcile-if-ready",
  },
  {
    label: "not fully settled current state",
    fragment: '"fullySettled": false',
  },
  {
    label: "fully settled go-live requirement",
    fragment:
      "Confirm `fullySettled: true` and at least one settlement id for `pay_mrayujpd_uha1hffh`.",
  },
] as const;

for (const fragment of [
  ...paidOutcomeFragments,
  ...failedRecoveryFragments,
  ...launchBoundaryFragments,
]) {
  assertContains(fragment);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      check: "seal_vortex_hosted_outcomes_boundary",
      boundary:
        "Static hosted-outcome proof audit only. It reads the checked-in proof note and never calls Convex, Finix, card payment, settlement reconciliation, payout, or production config.",
      proofDoc: proofDocPath,
      settlement: {
        fullySettledEvidence: false,
        status: "waiting_for_human_settlement_proof",
        requiredBeforeLaunch:
          "Confirm fullySettled true and at least one settlement id for pay_mrayujpd_uha1hffh.",
      },
      proven: [
        "captured hosted Vortex payment projects into Seal as paid and completes the document",
        "failed hosted Vortex payment projects into Seal as uncollectible and starts dunning",
        "duplicate failed events are skipped",
        "later paid recovery completes the document and cancels dunning",
        "stale failed events after paid are ignored",
        "settlement remains a separate human-run go-live boundary until fullySettled evidence exists",
      ],
    },
    null,
    2,
  ),
);
