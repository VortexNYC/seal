# Seal Vortex Payments Goal

Date: 2026-07-08
Host: local Mac plus Herdr as default remote execution host
Repo: /Users/shlomokabareti/Projects/Seal
Base: origin/staging
Active branch: codex/seal-stripe-removal-clean-baseline

## What We Are Shipping

Seal is moving from "Vortex replacement paths proven" to "Stripe physically removed from the codebase."

The goal is zero executable Stripe code, zero Stripe packages, zero Stripe runtime env dependency, and no active Seal product path that can call Stripe. Provider-neutral data migrations must land before deleting old Stripe-shaped persisted fields or tables.

## Current Truth

- PR #480 is merged to `staging`.
- Merged staging head before the cleanup branch: `065d4b92`.
- Local cleanup branch: `codex/seal-stripe-removal-clean-baseline`.
- Cleanup commit: `5ad70676 chore: format Seal migration baseline`.
- Worktree after cleanup commit is intended to be the clean deletion baseline.
- Current Stripe residue baseline: 151 files contain Stripe strings.
- `apps/backend/convex/stripe` still exists with 29 files.
- `apps/backend/package.json` still depends on `stripe`.
- Some `apps/backend/convex/payments/*` code still calls `internal.stripe.*` as a legacy provider fallback.

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
  - Current proof run: `mrapd8pd_plvbr7`.
  - Seal organization: `nh786p4dd411z53axac9yvmzdd8a2x7e`.
  - Seal document: `m17dg8d6ed374e579nqk0n59en8a3sky`.
  - Vortex payable: `payable_mrapdlpe_1o2l1to3`.
  - Hosted payment URL: `https://notable-leopard-969.convex.site/pay/pay_Ndq_9H6WHLF28px1beIF5LIbz9mHJCUAMFLz4LEPjXI`.
  - Amount: 4200 USD cents.
  - Seal state after creation: payment `awaiting`, invoice `open`, provider `vortex_billing`, document workflow `waiting_for_payment`.

## Not Proven Yet

Do not call full Stripe removal done until this exists:

1. `rg -i "stripe" apps packages scripts docs package.json bun.lock*` returns zero active-code/package hits, with any historical archive decision documented explicitly.
2. `apps/backend/convex/stripe` is deleted.
3. `apps/backend/package.json` and lockfile no longer include the `stripe` package.
4. `internal.stripe.*`, `api.stripe.*`, Stripe env names, and Stripe webhook routes are gone.
5. Stripe-shaped persisted data contracts are migrated or replaced with provider-neutral names.
6. Seal account creation, onboarding, SaaS billing, merchant setup, document payment creation, hosted payment outcomes, billing portal, merchant operations, and webhook processing all pass Vortex proofs.
7. Live-money settlement/payout proof remains human-run, but the code and harness must be ready.

## Single Biggest Limiter

The biggest limiter is now provider deletion order.

Deleting Stripe before replacing the remaining provider fallbacks and data contracts would break legacy paths and historical state. The correct order is:

1. Remove or replace remaining executable calls into `internal.stripe.*`.
2. Move persisted Stripe-shaped state to provider-neutral names.
3. Delete Stripe webhook/catalog/sync/runtime modules.
4. Remove the Stripe dependency and env contract.
5. Delete remaining tests, proof names, docs, and archive residue.
6. Run a zero-Stripe scanner as a hard gate.

## Immediate Execution Plan

1. Land the formatter cleanup branch.
2. Create Linear phase-2 deletion lanes under the existing project:
   - control
   - executable Stripe provider deletion
   - provider-neutral data migration
   - webhook/catalog/env deletion
   - package/lock removal
   - proof/test rename and final scanner
   - docs/archive cleanup
3. Start from account creation and onboarding, then SaaS billing, then merchant/document payment code, then operational/webhook code.
4. Keep every lane proof-gated:
   - `bun run format:changed:check`
   - `bun run lint:strict`
   - `bun run typecheck`
   - `bun run test`
   - `bun run build`
   - `bun run prove:vortex-payments-backend-adapter-adoption`
   - `bun run prove:vortex-operational-payments-adoption`
   - `bun run prove:seal-document-payment-vortex-local`
   - `bun run prove:vortex-saas-webhook-projection`
5. Live sandbox/payment/settlement proof stays a human-run boundary.

## Guardrails

- Do not claim Stripe is removed while `stripe`, `Stripe`, `STRIPE`, `@stripe`, `api.stripe`, `internal.stripe`, or `stripe_` remain in active code/package surfaces.
- Do not delete persisted fields/tables before migration/backfill proof exists.
- Do not use direct Finix reads from Seal.
- Do not reintroduce public Stripe actions or Stripe-shaped browser state.
- Do not run production Convex deploy from this thread.
- Do not push without explicit user confirmation.

## Status

Vortex replacement paths: staging-proven for non-money proof and sandbox-proven for onboarding.

Full Seal Stripe removal: not done.

Next proof target: zero-Stripe deletion phase with Linear-backed lanes.
