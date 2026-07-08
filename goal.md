# Seal Vortex Payments Goal

Date: 2026-07-08
Host: local Mac plus Herdr as default remote execution host
Repo: /Users/shlomokabareti/Projects/Seal
Base: origin/staging
Active branch: codex/sea-557-provider-neutral-data-contracts

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
- SEA-556 local lane removed the executable Stripe provider fallbacks from active payments/Vortex billing paths.
- Current Stripe residue after SEA-556 local edits: 149 files contain Stripe strings.
- Remaining `internal.stripe.*` calls are concentrated in the legacy `apps/backend/convex/stripe` modules and tests, not in `apps/backend/convex/payments` or `apps/backend/convex/vortex_billing`.
- SEA-557 first local cut moved active merchant account storage from `stripe_accounts` to provider-neutral `merchant_accounts`.
- Current Stripe residue after SEA-557 local edits: 143 files contain Stripe strings.
- Active `apps/backend/convex/payments` code is clean for `stripe_accounts`, `stripeAccountId`, `by_stripe_account`, `internal.stripe`, and `../stripe` references.
- SEA-557 second local cut moved payment field and document invoice ids to provider-neutral names:
  - `providerInvoiceId`
  - `providerSubscriptionId`
  - `providerPaymentIntentId`
  - `providerAccountId`
  - `providerCustomerId`
  - `providerProductId`
  - `providerPriceId`
- Current Stripe residue after the second SEA-557 local cut: 139 files contain Stripe strings.
- Active payment field/document invoice shared contract is clean for `stripeInvoiceId`, `stripeSubscriptionId`, `stripePaymentIntentId`, `stripeAccountId`, `stripeCustomerId`, `stripeProductId`, `stripePriceId`, `by_stripe_invoice`, and `by_stripe_subscription`.
- SEA-557 third local cut moved organization billing customer storage from `stripeCustomerId` / `by_stripe_customer_id` to `billingCustomerId` / `by_billing_customer`.
- Current Stripe residue after the third SEA-557 local cut: 138 files contain Stripe strings.
- Shared organization billing customer state is clean for `stripeCustomerId` and `by_stripe_customer_id`; remaining `stripeCustomerId` hits are legacy user cleanup, Stripe-only helper/promo code, and docs.
- SEA-557 fourth local cut moved subscription coupon/promo shared ids to provider-neutral names:
  - `providerCouponId`
  - `providerPromotionCodeId`
  - `providerCustomerId`
  - `by_provider_coupon`
  - `by_provider_promotion_code`
- Current Stripe residue after the fourth SEA-557 local cut: 136 files contain Stripe strings.
- Shared subscription coupon/promo schema is clean for `stripeCouponId`, `stripePromotionCodeId`, `stripeCustomerId`, `by_stripe_coupon_id`, and `by_stripe_promotion_code_id`.
- Remaining provider-neutral data-contract work is now legacy Stripe webhook tables and the legacy `apps/backend/convex/stripe` module tree.
- SEA-558 local cut deleted the executable backend Stripe runtime:
  - Removed `/stripe-webhook` and `/stripe-connect-webhook` HTTP routes.
  - Removed Stripe cron jobs.
  - Deleted `apps/backend/convex/stripe`.
  - Deleted `stripe_accounts` and `stripe_webhook_events` schema tables.
  - Removed the backend `stripe` package and lockfile entry.
  - Removed the E2E Stripe customer seeder and web caller.
  - Removed the remaining active provider literal `"stripe"` from document invoice and merchant surface contracts.
- SEA-558 strict active runtime/package scanner is clean for `stripe_accounts`, `stripe_webhook_events`, `internal.stripe`, `api.stripe`, `stripe/`, `STRIPE_`, `Stripe(`, `@stripe`, `stripe@`, `"stripe"`, and `v.literal("stripe")` across `apps/backend/convex`, web E2E setup, Vite manual chunks, backend package, root package, and `bun.lock`.
- Current broad Stripe residue after SEA-558 local edits: 95 files contain Stripe strings. Remaining hits are scripts/proofs, landing/docs copy/assets, comments/tests, legacy user cleanup, Stripe-shaped subscription safety naming, and non-Stripe visual/component naming like UI stripes.

## Proven For SaaS Billing

- `prove:seal-saas-checkout-vortex`
  - Vortex hosted checkout URL returned.
  - Seal Pro monthly resolved to `vtx_price_seal_pro_monthly_v2`.
  - Amount was 1900 USD cents.

- `prove:seal-saas-webhook-billing-state`
  - Vortex subscription webhook projection processed.
  - Billing settings show active Pro.
  - `activeStripeIdPresent` is false.

- Retired after SEA-558/SEA-559:
  - `prove:seal-saas-stripe-lifecycle-guard` was deleted because the backend Stripe lifecycle actions it called were intentionally removed.

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
2. `apps/backend/convex/stripe` is deleted. DONE locally in SEA-558.
3. `apps/backend/package.json` and lockfile no longer include the `stripe` package. DONE locally in SEA-558.
4. `internal.stripe.*`, `api.stripe.*`, Stripe env names, and Stripe webhook routes are gone. DONE locally for active backend/runtime/package surfaces in SEA-558.
5. Stripe-shaped persisted data contracts are migrated or replaced with provider-neutral names. Partially done; legacy `users.stripeCustomerId`, Stripe-shaped subscription proof naming, scripts, tests, comments, and docs still remain.
6. Seal account creation, onboarding, SaaS billing, merchant setup, document payment creation, hosted payment outcomes, billing portal, merchant operations, and webhook processing all pass Vortex proofs.
7. Live-money settlement/payout proof remains human-run, but the code and harness must be ready.

## Single Biggest Limiter

The biggest limiter is now residue discipline, not replacement implementation.

SEA-558 removed the executable backend Stripe runtime and package surface. The next cuts must delete or rename the remaining active-code string residue without hiding real migration risk:

1. Remove obsolete Stripe proof scripts and root script names that call deleted modules.
2. Rename provider-neutral comments/tests/proof field names that still say Stripe.
3. Remove or migrate legacy `users.stripeCustomerId`.
4. Update landing/product copy away from Stripe.
5. Decide what stays in historical `docs/archive`; document the archive exception or delete it.
6. Run a zero-Stripe scanner as a hard gate.

- SEA-559 local cut deleted obsolete proof scripts that referenced deleted Stripe backend modules:
  - `scripts/prove-seal-saas-stripe-lifecycle-guard.ts`
  - `scripts/prove-vortex-payments-backend-adapter-adoption.ts`
  - Removed their root package script aliases.

## Immediate Execution Plan

1. Commit SEA-558 backend runtime/package deletion cut locally.
2. Continue SEA-559 proof/script cleanup: delete obsolete Stripe lifecycle/backend-adapter proof scripts and root script entries that reference deleted modules.
3. Continue SEA-560 active code naming cleanup: comments, tests, legacy user field/migration, landing copy, and non-archived docs.
4. Continue SEA-561 final zero-Stripe scanner and archive decision.
5. Keep every lane proof-gated:
   - `bun run format:changed:check`
   - `bun run lint:strict`
   - `bun run typecheck`
   - `bun run test`
   - `bun run build`
   - `bun run prove:vortex-payments-backend-adapter-adoption`
   - `bun run prove:vortex-operational-payments-adoption`
   - `bun run prove:seal-document-payment-vortex-local`
   - `bun run prove:vortex-saas-webhook-projection`
6. Live sandbox/payment/settlement proof stays a human-run boundary.

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

Next proof target: SEA-559 proof/script cleanup and zero active script references to deleted Stripe modules.
