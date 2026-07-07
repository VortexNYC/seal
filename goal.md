# Seal Vortex Payments Goal

Date: 2026-07-07
Host: herdr
Repo: /home/debian/Projects/Seal
Base: origin/staging
Active branch: codex/seal-vortex-document-payment-proof

## What We Are Shipping

Seal is moving off Stripe in two distinct slices:

1. SaaS subscription billing for Seal plans through Vortex Billing.
2. Document payments and merchant money movement through Vortex Payments.

The SaaS slice is through staging. The next shipping target is the document-payment proof that makes the full Stripe replacement credible.

## Current Truth

- PR #468 is merged to `staging`.
- Merged commit: `10ef7f27 feat(billing): prove Seal SaaS checkout through Vortex`.
- Staging web deploy succeeded: `https://staging-app.seal.nyc`.
- Worker version: `ba8b236f-7c24-47c9-a41e-1476712f2abc`.
- CI on PR #468 was green: 4 passed, 0 failed, 3 skipped.
- Human live proofs passed on `dev:clever-goose-484`.
- Proof artifact committed: `docs/test-sessions/session-2026-07-07-seal-saas-vortex-billing.json`.
- Active document-payment proof branch: `codex/seal-vortex-document-payment-proof`.

## Proven For SaaS Billing

- `prove:seal-saas-checkout-vortex`
  - Vortex hosted checkout URL returned.
  - Seal Pro monthly resolved to `vtx_price_seal_pro_monthly_v2`.
  - Amount was 1900 USD cents.

- `prove:seal-saas-webhook-billing-state`
  - Vortex subscription webhook projection processed.
  - Billing settings show active Pro.
  - `activeStripeIdPresent` is false.

- `prove:seal-saas-stripe-lifecycle-guard`
  - Stripe org-created lifecycle skipped under `vortex_billing`.
  - Stripe seat sync skipped.
  - No Stripe customer/subscription was created.

- Staging browser check:
  - Billing settings page rendered on staging.
  - `getAvailablePlans` returned the Vortex-backed Seal Professional catalog.

## Newly Proven For Document Payments

- Targeted backend proof:
  - Command: `cd apps/backend && bun run test convex/vortex_billing/__tests__/webhook_projection.test.ts`
  - Result: 16 tests passed.
  - New coverage: Vortex `payable_object.updated` paid projection updates Seal payment state, patches Vortex lineage, marks the document invoice paid, and completes a waiting document.
  - New coverage: failed projection marks the Seal payment failed, marks the invoice uncollectible, and starts invoice dunning.
  - New coverage: unknown payable IDs are ignored without writing a webhook dedupe row.

- Adoption proofs still pass:
  - `bun run prove:vortex-payments-backend-adapter-adoption`
  - `bun run prove:vortex-operational-payments-adoption`

- First-class local document-payment proof now exists:
  - `bun run prove:seal-document-payment-vortex-local`
  - Boundary: local Seal-side document payment proof only; live sandbox card payment, platform-fee movement, settlements, and payouts still require live proof.

- Live payable-creation harness now exists:
  - `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live`
  - Boundary: creates a live Vortex-hosted document payment link and verifies Seal stores awaiting Vortex invoice state. It still does not pay the card or prove settlement/payout reconciliation.
  - Status: passed by Shlomo on 2026-07-07.
  - Proof run: `mraopvye_ezz5bx`.
  - Seal organization: `nh77n50weg647ywh9t3skjqdkn8a29pb`.
  - Seal document: `m1739cvde9w1x0zpj48qeagbw58a3rt4`.
  - Vortex payable: `payable_mraoq9vj_sv6qnc8z`.
  - Hosted payment URL: `https://notable-leopard-969.convex.site/pay/pay_nUIiDG0pBcFAnaKiuK50gF1y4m3YleHOydRv3y98MKQ`.
  - Amount: 4200 USD cents.
  - Seal state after creation: payment `awaiting`, invoice `open`, provider `vortex_billing`.

## Not Proven Yet

Do not call full Stripe replacement done until this exists:

1. Seal creates document-payment Vortex payables for all real payment types:
   - one-time
   - recurring
   - installments
   - deposit/balance
2. Recurring, installments, and deposit/balance get the same live creation proof as one-time.
3. A sandbox Vortex payment is actually paid, not only projected through a seeded webhook state.
4. Platform fee handling is proven on the payable request and through the resulting money movement.
5. The merchant operational surface reads real Vortex public settlements, payouts, and payout profile data for the same merchant path.
6. The proof stays inside Seal to Vortex public APIs. No direct Finix dependency from Seal.

## Single Biggest Limiter

The biggest limiter is not more SaaS billing polish.

The biggest limiter is one end-to-end document-payment money-path proof: pay the Vortex-hosted document payment, verify the real webhook projection back into Seal, and verify payout/settlement visibility for the merchant path.

Current code now proves the Seal-side webhook state transition locally and one-time live Vortex payable creation. That is progress, but it is still not enough for launch because the card payment, platform-fee movement, and settlement/payout visibility are not tied together in one proof.

## Immediate Execution Plan

1. Add a document-payment proof script under `scripts/`.
2. Reuse existing Convex proof helpers in `apps/backend/convex/vortex_billing/proof_actions.ts`.
3. Run one-time live creation first with:
   - `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live`
4. Extend the live harness to recurring/installments/deposit-balance.
5. Pay the hosted checkout from proof run `mraopvye_ezz5bx` and assert the resulting webhook projection.
6. Prove platform-fee settlement and merchant payout visibility for the same merchant path.
7. Assert Stripe absence explicitly where the state shape exposes it.
8. Keep local proof green:
   - `bun run prove:seal-document-payment-vortex-local`

## Guardrails

- Do not broaden back into SaaS subscription work unless a regression appears.
- Do not claim document payments are launch-ready from static adoption checks alone.
- Do not use direct Finix reads from Seal.
- Do not reintroduce public Stripe actions or Stripe-shaped browser state.
- Do not run production Convex deploy from this thread.

## Status

SaaS subscription billing via Vortex: staging-ready.

Full Seal Stripe replacement: not launch-ready.

Next proof target: paid Vortex-hosted document checkout plus merchant payout/settlement visibility.
