# Seal Vortex Payments Goal

Date: 2026-07-08
Repo: `/Users/shlomokabareti/Projects/Seal`
Base: `origin/staging`
Active branch: `codex/sea-557-provider-neutral-data-contracts`
Latest code cleanup commit: `b7be17b1` (`refactor: split webhook endpoint row`)
Latest launch-boundary commit: `aa16ba92` (`chore: harden Seal Vortex production boundary audit`)
Latest proof-state doc commit: inspect with `git log --oneline -1 -- goal.md` before acting.
Current head: inspect with `git rev-parse --short HEAD` before acting.
Linear control: `SEA-555`
Current lane: `SEA-562`

## Objective

Remove the legacy payment provider from Seal top down and leave Vortex Payments as the only active payment path.

This has two separate gates:

1. Code deletion gate: no tracked code, packages, scripts, config, product copy, or docs contain the legacy provider token.
2. Launch-readiness gate: Vortex Payments proves the active Seal paths end to end, including hosted payment outcomes, settlement visibility, and production routing boundaries.

Do not collapse these gates. Code deletion can be green while launch readiness is still proof-gated.

## Current Truth

- SEA-556 through SEA-561 are complete locally on `codex/sea-557-provider-neutral-data-contracts`.
- The strict residue guard scans every tracked path/content for the raw legacy-provider token, including archive docs, scans owned hidden env/config content, and separately blocks retired-provider alias wording in active guidance/config.
- `git ls-files | rg -i "<legacy-provider-token>"` returns no matches when the placeholder is replaced with the actual legacy provider word.
- Raw owned working-tree scan, including hidden env/config and excluding generated/install/cache outputs, returns no matches.
- Active raw legacy-provider token scan outside `.git`, installs, generated output, and caches returns no matches; legacy-provider-named path scan returns no paths.
- Non-archive retired-provider alias scan is intentionally down to the live top-down migration contract and the residue guard script.
- Obsolete/completed provider-migration docs and tracked local skill examples that taught retired-provider patterns were archived or neutralized in `a282d9c2`.
- The Vortex catalog live proof no longer seeds legacy-provider-shaped entitlement safety IDs; its safety organization now uses Vortex-shaped customer, subscription, product, and price ids, and the local migration gate statically blocks the old control from returning.
- Active Vortex proof/projection contracts now use provider-neutral wording (`activeNonVortexProviderIdPresent`) instead of stale legacy-provider field names, so future work does not confuse the Vortex migration proof with a retained legacy implementation.
- `bun run prove:seal-vortex-migration-local` is the local non-mutating migration gate that composes residue, account/onboarding guards, settings, SaaS checkout/catalog/coupon/portal proofs, webhook projection, backend adapter, operational surface, document-payment local proofs, sandbox settlement handoff, and launch-boundary drift detection.
- `bun run audit:seal-vortex-launch-boundary` now surfaces the sandbox human reconciliation boundary and the production human-only boundary, and fails if production remediation commands do not exactly match the missing production env names.
- `bun run prove:seal-saas-webhook-billing-state` now pushes the current checkout to the Seal dev deployment before running, so the live/dev SaaS billing-state proof cannot pass against stale deployed functions.
- The Seal dev `organizations` table was cleaned from stale retired-provider customer-field residue on 2026-07-08 by replacing the table with the same 85 rows minus the retired field; document ids and creation times were preserved.
- Non-production Convex data cleanup on 2026-07-08 emptied old retired-provider account/webhook tables in local dev (`dev:aware-buzzard-568`) and staging/dev (`dev:clever-goose-484`), and cleaned the same retired customer field from 6 local-dev organization rows while preserving ids and creation times. Backups were saved under `/tmp` on this machine.
- Current local verification passed after cleanup commit `b7be17b1`:
  - `bun run prove:zero-retired-provider-residue`
  - explicit hidden/no-ignore owned working-tree legacy-provider token scan
  - `bun run verify`
  - `bun run test`
  - `bun run typecheck`
  - `bun run lint -f json > /tmp/webhooks-endpoint-row-lint.json`
  - `bun run build`
  - `git diff --check`
  - `bun run audit:seal-vortex-hosted-outcomes-boundary`
  - `bun run audit:seal-vortex-sandbox-settlement-boundary`
  - `bun run audit:seal-vortex-launch-boundary`
- No git push has been performed from this branch. Remote push still requires explicit human confirmation.

## Replacement Proof State

- Account and organization creation is anchored in Vortex Auth and does not create retired-provider state.
- `bun run prove:seal-account-onboarding-vortex-local` proves account creation, Vortex Auth anchoring, retired merchant-surface blocking, charges-ready merchant resolution, and Vortex payable request mapping without live mutation.
- Merchant onboarding and settings paths route through Vortex-owned actions for Vortex document-payment organizations.
- SaaS checkout, subscription webhook projection, catalog, and coupon paths are Vortex-backed.
- `bun run prove:seal-saas-vortex-local` proves the non-mutating SaaS checkout, catalog-price resolver, coupon, portal, and lifecycle guard replacement paths.
- Document payable creation through Vortex is proven locally and in sandbox for the current supported path.
- Hosted Vortex payment capture has projected into Seal as paid and completed the waiting document.
- Failed hosted payment recovery is proven: failed outcome marks the invoice uncollectible, starts dunning once, ignores duplicate failures, and cancels dunning after a later paid event.
- `bun run audit:seal-vortex-hosted-outcomes-boundary` statically preserves the checked-in paid capture, failed recovery, dunning, idempotency, and settlement-boundary proof artifact without calling live systems.

## Not Done

- The local branch has not been pushed or merged.
- Sandbox document-payment settlement is not proven fully settled yet.
- `bun run audit:seal-vortex-sandbox-settlement-boundary` preserves the captured sandbox payment ids, earliest human reconciliation timestamp, the Vortex final sandbox launch gate, and human-run settlement commands without calling Convex, Finix, or reconciliation. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
- Production Vortex document-payment routing is not configured.
- Production real-money proof is not complete.
- Widening the document-payment allowlist and retiring external production webhooks is blocked until production proof passes.
- New live document-payment proof runs seed `VORTEX_BILLING_DOCUMENT_*` maps instead of shared SaaS maps.
- Human-run Vortex proof scripts that call the Vortex Payments checkout accept `VORTEX_PAYMENTS_REPO_ROOT` when the sibling checkout is not at `../vortex-payments`.
- `bun run prove:seal-vortex-migration-local` statically fails if known live or env-mutating proof commands are added to the local non-mutating gate.

## Production Readiness Audit

Latest production config audit command:

```bash
bun run audit:seal-vortex-production-readiness
```

Current result from the latest agent refresh: failing, as expected, without printing secret values.
The audit checks required production names plus safe value shape/runtime expectations for any values that are present. It also prints a human-run remediation checklist with exact deployment-scoped `convex env set` commands and placeholders for the missing values, plus machine-readable `agentAllowedActions`, `humanOnlyActions`, and `successCriteria`. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`. Agents must not execute those commands against production.

Non-mutating launch-boundary wrapper:

```bash
bun run audit:seal-vortex-launch-boundary
```

This wrapper passes only when the sandbox settlement handoff is intact and production readiness is either green or blocked only by the known human-run production configuration names listed below. It fails on invalid present production config, unexpected missing env names, remediation commands that omit missing env names, or remediation commands that include non-missing env names.

Missing Seal production names:

- `VORTEX_BILLING_PAYMENTS_ENVIRONMENT`
- `VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS`
- `VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP`
- `VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP`
- `VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP`
- `VORTEX_BILLING_DOCUMENT_PRICE_MAP`

Missing Vortex production names:

- `VORTEX_PAYMENTS_RUNTIME_MODE`
- `FINIX_PRODUCTION_USERNAME`
- `FINIX_PRODUCTION_PASSWORD`
- `FINIX_PRODUCTION_APPLICATION_ID`
- `FINIX_PRODUCTION_WEBHOOK_SECRET`

Latest non-mutating refresh results recorded on this branch:

- `bun run prove:zero-retired-provider-residue` passed and scans owned hidden env/config content.
- Explicit hidden/no-ignore owned working-tree legacy-provider token scan returned no matches.
- `bun run verify` passed.
- `bun run test` passed with 74 test files and 1370 tests.
- `bun run typecheck` passed.
- `bun run lint -f json > /tmp/webhooks-endpoint-row-lint.json` passed; parsed diagnostics total: `0`.
- `bun run build` passed.
- `git diff --check` passed.
- `bun run prove:seal-account-onboarding-vortex-local` passed with 4 files and 13 tests.
- `bun run prove:seal-vortex-onboarding-wiring` passed against `dev:clever-goose-484` and `dev:notable-leopard-969`; hosted onboarding reconciled to Vortex, `chargesEnabled: true`, the Seal resolver returned the Vortex merchant account, and the payout profile reported net daily next-day ACH.
- `bun run prove:vortex-billing-settings-adoption` passed.
- `bun run prove:vortex-payments-settings-adoption` passed.
- `bun run prove:vortex-merchant-settings-adoption` passed.
- `bun run prove:seal-saas-vortex-local` passed with 2 files and 23 tests.
- `bun run prove:seal-catalog-from-vortex` passed against `dev:clever-goose-484` and Vortex `https://notable-leopard-969.convex.site`; synced 16 products and 22 prices and preserved Vortex-shaped entitlement safety.
- `bun run prove:seal-coupons-vortex` passed against Vortex public catalog/customer/checkout/coupon APIs; discounted checkout total was 3750 from a 5000 price, invalid promo code created no checkout, and no-code checkout stayed at 5000.
- `bun run prove:seal-saas-checkout-vortex` passed against `dev:clever-goose-484` and `dev:notable-leopard-969`; checkout used `pro:monthly:v2`, Vortex price `vtx_price_seal_pro_monthly_v2`, and returned a hosted Vortex `/pay/` URL for 1900.
- `bun run prove:vortex-saas-webhook-projection` passed with 3 files and 22 tests.
- `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-saas-webhook-billing-state` passed after syncing current Convex code; result projected Vortex-shaped customer/subscription/price ids and reported `activeNonVortexProviderIdPresent: false`.
- `bun run prove:seal-document-payment-vortex-local` passed.
- `bun run prove:vortex-operational-payments-adoption` passed.
- `bun run prove:vortex-payments-backend-adapter-adoption` passed.
- `bun run prove:seal-vortex-migration-local` passed.
- `bun run prove:seal-vortex-migration-local` now includes the Vortex-shaped catalog entitlement safety guard.
- `bun run audit:seal-vortex-hosted-outcomes-boundary` passed.
- `bun run audit:seal-vortex-sandbox-settlement-boundary` passed with readiness window still reported as `waiting` and `earliestHumanReconcileAt` preserved as `2026-07-08T18:12:06.10Z`.
- `bun run audit:seal-vortex-launch-boundary` passed as a non-mutating guard and now reports `launchReady: false`, waiting on `human_settlement_proof` and `production_config`, while surfacing the sandbox and production human-only boundaries.
- `bun run audit:seal-vortex-production-readiness` failed only on the known missing production names listed above and prints the agent-allowed actions, human-only actions, and production success criteria without secret values.
- Branch worktree was clean after the latest recorded verification.

## Current Human Boundary

Agents may prepare commands, audits, and proof harnesses.

Agents may also record missing or invalid production config names without secret values and update repo docs or Linear with non-secret proof state.

Agents must not run:

- live card payment commands,
- production credential mutation,
- production money movement,
- settlement or payout proof commands that reconcile live money state,
- production document-payment allowlist widening,
- external production webhook retirement,
- remote git push without explicit confirmation.

## Next Action

Work SEA-562:

1. Keep this repo doc and Linear synchronized with current proof.
2. Preserve the exact human-run sandbox settlement command from `docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md`.
3. Run non-mutating local proof gates only:
   - `bun run prove:seal-vortex-migration-local`
   - `bun run audit:seal-vortex-hosted-outcomes-boundary`
   - `bun run audit:seal-vortex-sandbox-settlement-boundary`
   - `bun run audit:seal-vortex-production-readiness`
   - `bun run audit:seal-vortex-launch-boundary`
4. Do not mark launch readiness complete until settled sandbox proof and production proof both pass.
