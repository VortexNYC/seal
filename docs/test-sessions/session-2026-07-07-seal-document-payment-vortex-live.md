# Seal Document Payment Vortex Live Proof

Date: 2026-07-07
Host: herdr
Repo: /home/debian/Projects/Seal
Branch: codex/seal-vortex-document-payment-proof

## Command

```bash
cd /home/debian/Projects/Seal
SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live
```

## Result

Passed.

```json
{
  "ok": true,
  "check": "seal_document_payment_vortex_live",
  "boundary": "Creates a live Vortex-hosted document payment link. Actual card payment, platform-fee settlement, and payout reconciliation remain follow-up proof.",
  "sealDeployment": "dev:clever-goose-484",
  "vortexDeployment": "dev:notable-leopard-969",
  "vortexBaseUrl": "https://notable-leopard-969.convex.site",
  "proofRunId": "mraopvye_ezz5bx",
  "organizationId": "nh77n50weg647ywh9t3skjqdkn8a29pb",
  "documentId": "m1739cvde9w1x0zpj48qeagbw58a3rt4",
  "lineItemId": "seal_document_payment_line_mraopvye_ezz5bx",
  "priceId": "vtx_price_seal_document_payment_mraopvye_ezz5bx",
  "billingAccountId": "bacc_seal_document_payment_mraopvye_ezz5bx",
  "customerId": "vtx_cust_seal_document_payment_mraopvye_ezz5bx",
  "merchantAccountId": "ma_seal_document_payment_proof",
  "payment": {
    "vortexPayableId": "payable_mraoq9vj_sv6qnc8z",
    "hostedInvoiceUrl": "https://notable-leopard-969.convex.site/pay/pay_nUIiDG0pBcFAnaKiuK50gF1y4m3YleHOydRv3y98MKQ",
    "totalAmountCents": 4200,
    "currency": "usd"
  },
  "state": {
    "paymentStatus": "awaiting",
    "invoiceStatus": "open",
    "invoiceProvider": "vortex_billing"
  }
}
```

## What This Proves

- Seal can create a live one-time document-payment payable through Vortex.
- Vortex returns a hosted payment URL.
- Seal stores the document invoice as `vortex_billing`.
- Seal stores the payment in `awaiting` state with an open invoice.

## What This Does Not Prove

- Sandbox card payment completion.
- Real webhook projection after a paid checkout.
- Platform-fee movement.
- Settlement and payout reconciliation.
- Recurring, installment, and deposit/balance document payment creation.

## Next Limiter

Pay the hosted Vortex checkout for `payable_mraoq9vj_sv6qnc8z`, then prove the real webhook updates Seal and the merchant money path is visible through Vortex settlement/payout surfaces.

## Follow-Up Live Proof

Command:

```bash
cd /home/debian/Projects/Seal
SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live
```

Result: passed.

```json
{
  "ok": true,
  "check": "seal_document_payment_vortex_live",
  "proofRunId": "mrapd8pd_plvbr7",
  "organizationId": "nh786p4dd411z53axac9yvmzdd8a2x7e",
  "documentId": "m17dg8d6ed374e579nqk0n59en8a3sky",
  "lineItemId": "seal_document_payment_line_mrapd8pd_plvbr7",
  "priceId": "vtx_price_seal_document_payment_mrapd8pd_plvbr7",
  "billingAccountId": "bacc_seal_document_payment_mrapd8pd_plvbr7",
  "customerId": "vtx_cust_seal_document_payment_mrapd8pd_plvbr7",
  "merchantAccountId": "ma_seal_document_payment_proof",
  "payment": {
    "vortexPayableId": "payable_mrapdlpe_1o2l1to3",
    "hostedInvoiceUrl": "https://notable-leopard-969.convex.site/pay/pay_Ndq_9H6WHLF28px1beIF5LIbz9mHJCUAMFLz4LEPjXI",
    "totalAmountCents": 4200,
    "currency": "usd"
  },
  "state": {
    "paymentStatus": "awaiting",
    "invoiceStatus": "open",
    "invoiceProvider": "vortex_billing",
    "documentWorkflowStatus": "waiting_for_payment"
  }
}
```

Paid-state check result: blocked because the Vortex payable is not paid yet.

```json
{
  "diagnosis": "vortex_payable_not_paid",
  "vortex": {
    "status": "awaiting_payment",
    "amountPaid": 0,
    "amountRemaining": 4200
  },
  "seal": {
    "paymentStatus": "awaiting",
    "invoiceStatus": "open",
    "invoiceProvider": "vortex_billing",
    "documentWorkflowStatus": "waiting_for_payment"
  }
}
```

Next limiter: pay `https://notable-leopard-969.convex.site/pay/pay_Ndq_9H6WHLF28px1beIF5LIbz9mHJCUAMFLz4LEPjXI`, then run the paid-state proof with `payable_mrapdlpe_1o2l1to3`.

## Browser Payment Attempt

The hosted page for `payable_mrapdlpe_1o2l1to3` did not expose a card form. It showed:

```text
Uncaught Error: billing account bacc_seal_document_payment_mrapd8pd_plvbr7 is not configured for automatic collection
```

Cause: the document-payment live proof created the Vortex billing account with `collectionMode: "manual"` and `autoCollectionEnabled: false`, but hosted card payment collection requires `collectionMode: "automatic"` and `autoCollectionEnabled: true`.

Fix: create future document-payment proof billing accounts with automatic collection enabled, then generate a fresh hosted payment link.

## Current Active Settlement Proof

Fresh proof run using the dedicated Seal Vortex merchant:

```text
merchantAccountId: ma_mray5jl6_54g5ghkm
vortexPayableId: payable_mray9uu0_58xe8f37
hostedInvoiceUrl: https://notable-leopard-969.convex.site/pay/pay_8j0wUAe2iDThLirDfGeN1IDCBkh2yauaJr0CKRuBCws
paymentId: pay_mrayujpd_uha1hffh
paymentIntentId: pi_mrayujoq_exfbt5de
receiptId: rcpt_mrayujtq_3rtpfx4q
```

Paid-state proof passes for capture and Seal workflow projection:

```bash
cd /home/debian/Projects/Seal
SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 \
VORTEX_CONVEX_DEPLOYMENT=dev:notable-leopard-969 \
bun run prove:seal-document-payment-vortex-paid-state -- \
  --vortex-payable-id payable_mray9uu0_58xe8f37 \
  --hosted-invoice-url https://notable-leopard-969.convex.site/pay/pay_8j0wUAe2iDThLirDfGeN1IDCBkh2yauaJr0CKRuBCws
```

Observed proof state:

```json
{
  "paymentStatus": "paid",
  "invoiceStatus": "paid",
  "invoiceProvider": "vortex_billing",
  "documentWorkflowStatus": "completed",
  "vortexPaymentStatus": "captured",
  "settlement": {
    "settlementCount": 0,
    "settlementEntryCount": 0,
    "unsettledPaymentCount": 1,
    "fullySettled": false,
    "nextAction": "sync_payment_settlement"
  }
}
```

Hard settled proof gate intentionally fails until settlement lineage exists:

```bash
cd /home/debian/Projects/Seal
SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 \
VORTEX_CONVEX_DEPLOYMENT=dev:notable-leopard-969 \
bun run prove:seal-document-payment-vortex-paid-state -- \
  --vortex-payable-id payable_mray9uu0_58xe8f37 \
  --hosted-invoice-url https://notable-leopard-969.convex.site/pay/pay_8j0wUAe2iDThLirDfGeN1IDCBkh2yauaJr0CKRuBCws \
  --require-settled
```

Expected current failure:

```json
{
  "ok": false,
  "diagnosis": "vortex_payment_not_fully_settled",
  "nextAction": "sync_payment_settlement"
}
```

Vortex settlement readiness inspection shows the external provider time gate:

```bash
cd /home/debian/Projects/vortex-payments
CONVEX_DEPLOYMENT=dev:notable-leopard-969 \
bun run inspect:vortex-payment-settlement-readiness -- \
  --environment sandbox \
  --payment-id pay_mrayujpd_uha1hffh \
  --expected-merchant-account-id ma_mray5jl6_54g5ghkm \
  --reconcile-if-ready
```

Current readiness:

```json
{
  "status": "waiting_for_provider_ready_to_settle",
  "readyToSettleAt": "2026-07-08T18:12:06.10Z",
  "reconciliation": {
    "requested": true,
    "ran": false,
    "skippedReason": "wait_until_provider_ready_to_settle"
  }
}
```

## Failed Payment Recovery Proof

Command run on Herdr:

```bash
cd /home/debian/Projects/vortex-payments
SEAL_REPO_ROOT=/home/debian/Projects/Seal \
bun run prove:seal-vortex-failed-payment-recovery-cloud
```

Result: passed.

```json
{
  "ok": true,
  "proof": "seal-vortex-failed-payment-recovery-cloud",
  "sealDeployment": "dev:clever-goose-484",
  "vortexPayableId": "payable_failed_cloud_mrb0nwci_fph8e0",
  "vortexPaymentRequestId": "preq_failed_cloud_mrb0nwci_fph8e0",
  "duplicateFailedSkipped": true,
  "staleFailedIgnoredAfterPaid": true,
  "failedInvoiceStatus": "uncollectible",
  "failedDunningStatus": "active",
  "finalPaymentStatus": "paid",
  "finalDocumentWorkflowStatus": "completed",
  "finalInvoiceStatus": "paid",
  "finalDunningStatus": "cancelled"
}
```

This proves the Seal document-payment Vortex webhook path handles the failure side of the lifecycle:

- A failed Vortex payable event marks the Seal invoice uncollectible.
- Dunning starts once.
- A duplicate failed event is ignored.
- A later paid Vortex event completes the document and cancels dunning.
- A stale failed event after paid is ignored.

## Go-Live Gate

For the current phase, "Seal works on Vortex Payments" means controlled sandbox launch-readiness. Production real-money proof is separate and intentionally later.

Do not call Seal document payments sandbox launch-ready until this exact sequence passes:

1. After `2026-07-08T18:12:06.10Z`, run the Vortex readiness command above with `--reconcile-if-ready`.
2. Re-run the Seal paid-state proof with `--require-settled`.
3. Confirm `fullySettled: true` and at least one settlement id for `pay_mrayujpd_uha1hffh`.
4. Only then promote this sandbox document-payment proof from captured to settled.
5. Production real-money launch still requires production credentials, a production Seal merchant, one real small document payment, real settlement/payout visibility, then the allowlist flip and retired provider webhook retirement.

Current sandbox launch answer: SaaS is green, document payable creation is green, real hosted document payment capture and Seal projection are green, failed-payment recovery is green, and settled document-payment money movement is still waiting on provider settlement readiness.

The non-mutating Seal launch audit now preserves the same human-only boundary in machine-readable output:

```bash
cd /home/debian/Projects/Seal
bun run audit:seal-vortex-launch-boundary
```

Expected until settlement and production proof are complete:

```text
launchReady=false
waitingOn=human_settlement_proof,production_config
earliestHumanReconcileAt=2026-07-08T18:12:06.10Z
```

Agents may run the audit and record non-secret proof state. Agents must not run reconciliation, settlement, payout, live card, production env mutation, allowlist widening, or production webhook retirement.

## Proof Harness Contract

Future `prove:seal-document-payment-vortex-live` runs seed the document-payment-specific Seal env contract, not the shared SaaS maps:

```text
VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS
VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP
VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP
VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP
VORTEX_BILLING_DOCUMENT_PRICE_MAP
```

This is intentional. Document-payment real money must not silently reuse SaaS billing maps.

## Production Gate Audit

Presence-only audit run on Herdr. No secret values should be recorded here.

Vortex production deployment: `prod:quixotic-snake-887`

```text
FINIX_PRODUCTION_USERNAME=empty
FINIX_PRODUCTION_PASSWORD=empty
FINIX_PRODUCTION_APPLICATION_ID=empty
FINIX_PRODUCTION_WEBHOOK_SECRET=empty
VORTEX_PAYMENTS_PROVIDER=set
VORTEX_PAYMENTS_RUNTIME_MODE=empty
```

Meaning: Vortex production can select the provider, but it does not have Finix production credentials or production runtime mode configured. Real-money Vortex document payments cannot launch until these are set and proven.

Seal production deployment: `prod:compassionate-robin-742`

```text
VORTEX_BILLING_API_BASE_URL=set
VORTEX_BILLING_API_KEY=set
VORTEX_BILLING_WEBHOOK_SECRET=set
VORTEX_BILLING_PAYMENTS_ENVIRONMENT=empty
VORTEX_BILLING_SAAS_ORGANIZATION_IDS=set
VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS=empty
VORTEX_BILLING_ACCOUNT_MAP=set
VORTEX_BILLING_SAAS_PRICE_MAP=set
VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP=empty
VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP=empty
VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP=empty
VORTEX_BILLING_DOCUMENT_PRICE_MAP=empty
```

Meaning: Seal production has the SaaS Vortex config, but document-payment production routing is not configured. Before flipping document payments, production needs an explicit document-payment allowlist plus document billing account, customer, merchant, and price maps for the target organization.

Production go-live work left after sandbox settlement proof:

1. Configure Vortex production Finix credentials and runtime mode.
2. Create/prove a production Seal document-payment merchant through Vortex.
3. Configure Seal production document-payment allowlist and maps for exactly one internal target organization.
4. Run one real small production document payment.
5. Wait for real settlement/payout visibility.
6. Run the paid-state proof with `--require-settled` against production ids.
7. Only then widen the allowlist and retire retired provider webhooks.

The production readiness audit is intentionally non-mutating:

```bash
cd /home/debian/Projects/Seal
bun run audit:seal-vortex-production-readiness
```

Expected until production is configured: it exits nonzero, lists only missing/invalid production config names, prints no secret values, and emits:

- `agentAllowedActions`
- `humanOnlyActions`
- `successCriteria`

The aggregate launch audit fails if remediation commands omit missing env names or include non-missing env names.
