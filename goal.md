# Seal Vortex Payments Goal

Date: 2026-07-08
Repo: `/Users/shlomokabareti/Projects/Seal`
Base: `origin/staging`
Active branch: `codex/sea-557-provider-neutral-data-contracts`
Latest code cleanup commit: inspect with `git log --oneline -1 -- scripts apps packages docs goal.md`.
Latest launch-boundary commit: inspect with `git log --oneline -1 -- scripts/audit-seal-vortex-launch-boundary.ts scripts/audit-seal-vortex-production-proof-boundary.ts goal.md`.
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
- The strict residue guard scans every tracked path/content for the raw legacy-provider token, including archive docs, scans owned hidden env/config content, and separately blocks old-provider alias wording in active guidance/config/current-plan files.
- `git ls-files | rg -i "<legacy-provider-token>"` returns no matches when the placeholder is replaced with the actual legacy provider word.
- Raw owned working-tree scan, including hidden env/config and excluding generated/install/cache outputs, returns no matches.
- Active raw legacy-provider token scan outside `.git`, installs, generated output, and caches returns no matches; legacy-provider-named path scan returns no paths.
- Non-archive old-provider alias scan is intentionally down to exact proof command names and the residue guard script.
- Obsolete/completed provider-migration docs and tracked local skill examples that taught old-provider patterns were archived or neutralized in `a282d9c2`.
- The Vortex catalog live proof no longer seeds non-Vortex-provider-shaped entitlement safety IDs; its safety organization now uses Vortex-shaped customer, subscription, product, and price ids, and the local migration gate statically blocks the old control from returning.
- Active Vortex proof/projection contracts now use provider-neutral wording (`activeNonVortexProviderIdPresent`) instead of stale old-provider field names, so future work does not confuse the Vortex migration proof with a retained legacy implementation.
- Active subscription coupon and promo-code mirror schemas now name Vortex Billing as the source of truth, and the strict residue guard fails if those active schemas drift back to generic payment-provider wording.
- `pnpm run prove:seal-vortex-migration-local` is the local non-mutating migration gate that composes residue, account/onboarding guards, settings, SaaS checkout/catalog/coupon/portal proofs, webhook projection, backend adapter, operational surface, document-payment local proofs, sandbox settlement handoff, and launch-boundary drift detection.
- `pnpm run audit:seal-vortex-launch-boundary` now surfaces sandbox settlement readiness, production config readiness, production proof readiness, and fails if production remediation commands do not exactly match missing production env names.
- `pnpm run audit:seal-vortex-production-proof-boundary` keeps production live-money proof and post-proof external residue retirement as explicit launch blockers until a checked-in production proof artifact exists.
- `pnpm run prove:seal-vortex-production-proof-boundary` proves the production proof boundary fails closed on incomplete production proof artifacts, distinguishes money-proof-only from full go-live evidence, and requires post-proof retirement markers.
- `pnpm run audit:seal-vortex-launch-boundary` cannot report `launchReady: true` from production config alone; it now also requires production money proof and post-proof retirement evidence.
- `pnpm run prove:seal-saas-webhook-billing-state` now pushes the current checkout to the Seal dev deployment before running, so the live/dev SaaS billing-state proof cannot pass against stale deployed functions.
- `pnpm run prove:seal-coupons-vortex` now merges its temporary proof price into `VORTEX_BILLING_SAAS_PRICE_MAP` instead of replacing the whole map; this preserves the `pro:monthly:v2` checkout mapping when coupon proofs run before SaaS checkout proofs.
- The Seal dev `organizations` table was cleaned from stale old-provider customer-field residue on 2026-07-08 by replacing the table with the same 85 rows minus the retired field; document ids and creation times were preserved.
- Non-production Convex data cleanup on 2026-07-08 emptied old provider account/webhook tables in local dev (`dev:aware-buzzard-568`) and staging/dev (`dev:clever-goose-484`), and cleaned the same retired customer field from 6 local-dev organization rows while preserving ids and creation times. Backups were saved under `/tmp` on this machine.
- Latest local proof refresh has passed on this branch, including root quality gates; rerun the root gates after any non-doc runtime change:
  - `pnpm run prove:zero-retired-provider-residue`
  - explicit hidden/no-ignore owned working-tree legacy-provider token scan
  - `pnpm run verify`
  - `pnpm run test`
  - `pnpm run typecheck`
  - `pnpm run lint -f json > /tmp/webhooks-endpoint-row-lint.json`
  - `pnpm run build`
  - `git diff --check`
  - `pnpm run audit:seal-vortex-hosted-outcomes-boundary`
  - `pnpm run audit:seal-vortex-sandbox-settlement-boundary`
  - `pnpm run audit:seal-vortex-launch-boundary`
- No git push has been performed from this branch. Remote push still requires explicit human confirmation.
- Remote review is not open yet: inspect the current local-vs-staging count with `git rev-list --left-right --count origin/staging...HEAD`; `origin/codex/sea-557-provider-neutral-data-contracts` does not exist, and there is no open PR for this branch. PR #480 is merged historical work and does not contain the current proof-boundary branch head.

## Replacement Proof State

- Account and organization creation is anchored in Vortex Auth and does not create legacy payment-provider state.
- `pnpm run prove:seal-account-onboarding-vortex-local` proves account creation, Vortex Auth anchoring, retired merchant-surface blocking, charges-ready merchant resolution, and Vortex payable request mapping without live mutation.
- Merchant onboarding and settings paths route through Vortex-owned actions for Vortex document-payment organizations.
- SaaS checkout, subscription webhook projection, catalog, and coupon paths are Vortex-backed.
- `pnpm run prove:seal-saas-vortex-local` proves the non-mutating SaaS checkout, catalog-price resolver, coupon, portal, and lifecycle guard replacement paths.
- Document payable creation through Vortex is proven locally and in sandbox for the current supported path.
- Hosted Vortex payment capture has projected into Seal as paid and completed the waiting document.
- Failed hosted payment recovery is proven: failed outcome marks the invoice uncollectible, starts dunning once, ignores duplicate failures, and cancels dunning after a later paid event.
- `pnpm run audit:seal-vortex-hosted-outcomes-boundary` statically preserves the checked-in paid capture, failed recovery, dunning, idempotency, and settlement-boundary proof artifact without calling live systems.

## Not Done

- The local branch has not been pushed or merged; it is currently local-only with no remote branch and no open PR. Inspect the current ahead count with `git rev-list --left-right --count origin/staging...HEAD`.
- Sandbox document-payment settlement is not proven fully settled yet.
- `pnpm run audit:seal-vortex-sandbox-settlement-boundary` preserves the captured sandbox payment ids, earliest reconciliation timestamp, the Vortex final sandbox launch gate, and settlement commands without calling Convex, Finix, or reconciliation. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
- Production Seal Vortex document-payment routing is configured for the MCP production workspace only.
- Production real-money proof is not complete.
- Widening the document-payment allowlist and retiring external production webhooks is blocked until production proof passes.
- Read-only production data audit on 2026-07-08 found the old provider webhook-events table still has 22 rows; the old provider account table is empty, and checked active tables had no retired-token docs or were empty. Agents must not retire this production residue until production proof passes.
- New live document-payment proof runs seed `VORTEX_BILLING_DOCUMENT_*` maps instead of shared SaaS maps.
- Vortex proof scripts that call the Vortex Payments checkout accept `VORTEX_PAYMENTS_REPO_ROOT` when the sibling checkout is not at `../vortex-payments`.
- `pnpm run prove:seal-vortex-migration-local` statically fails if known live or env-mutating proof commands are added to the local non-mutating gate.
- `pnpm run prove:seal-vortex-migration-local` statically fails if live/dev Vortex proof scripts replace existing Vortex map env values instead of merging updates into those maps.
- `pnpm run prove:seal-vortex-migration-local` now includes the production proof boundary audit, so launch readiness stays false until production proof and post-proof retirement evidence are checked in.
- `pnpm run prove:seal-vortex-migration-local` now includes the production proof boundary self-proof, so malformed production proof notes cannot silently satisfy launch readiness.

## Production Readiness Audit

Latest production config audit command:

```bash
pnpm run audit:seal-vortex-production-readiness
```

Current result from the latest agent refresh: failing only on missing Vortex Finix production credentials, without printing secret values.
The audit checks required production names plus safe value shape/runtime expectations for any values that are present. It prints remediation commands with exact deployment-scoped `convex env set` shapes and placeholders for missing values, plus machine-readable `agentAllowedActions`, `operatorControlledActions`, and `successCriteria`. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.

Non-mutating launch-boundary wrapper:

```bash
pnpm run audit:seal-vortex-launch-boundary
```

This wrapper passes only when the sandbox settlement handoff is intact and production readiness is either green or blocked only by the known production configuration names listed below. It fails on invalid present production config, unexpected missing env names, remediation commands that omit missing env names, or remediation commands that include non-missing env names.
It also includes the production proof boundary and cannot become launch-ready until production money proof and post-proof external residue retirement evidence are recorded in `docs/test-sessions/session-2026-07-08-seal-vortex-production-go-live.md`.

Configured Seal production document-payment names:

- `VORTEX_BILLING_PAYMENTS_ENVIRONMENT=production`
- `VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS=["jd79vzsynmb6absn1f9adpa4t987x1tz"]`
- `VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP={"jd79vzsynmb6absn1f9adpa4t987x1tz":"bacc_seal_prod_mcp_org_saas_dry_run"}`
- `VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP={"jd79vzsynmb6absn1f9adpa4t987x1tz":"vtx_cust_seal_org_jd79vzsynmb6absn1f9adpa4t987x1tz"}`
- `VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP={"jd79vzsynmb6absn1f9adpa4t987x1tz":"ma_seal_prod_mcp_saas_dry_run"}`
- `VORTEX_BILLING_DOCUMENT_PRICE_ID=vtx_price_seal_prod_mcp_document_one_time_20260708`

Missing Vortex production names:

- `FINIX_PRODUCTION_USERNAME`
- `FINIX_PRODUCTION_PASSWORD`
- `FINIX_PRODUCTION_APPLICATION_ID`
- `FINIX_PRODUCTION_WEBHOOK_SECRET`

Configured Vortex production setup:

- `VORTEX_PAYMENTS_RUNTIME_MODE=finix`
- Product `vtx_prod_seal_prod_mcp_document_payments_20260708`
- Price `vtx_price_seal_prod_mcp_document_one_time_20260708`

Latest non-mutating refresh results recorded on this branch:

- `pnpm run prove:zero-retired-provider-residue` passed and scans owned hidden env/config content.
- Explicit hidden/no-ignore owned working-tree legacy-provider token scan returned no matches.
- `pnpm run verify` passed.
- `pnpm run test` passed with 74 test files and 1370 tests.
- `pnpm run typecheck` passed.
- `pnpm run lint -f json > /tmp/webhooks-endpoint-row-lint.json` passed; parsed diagnostics total: `0`.
- `pnpm run build` passed.
- `git diff --check` passed.
- `pnpm run prove:seal-account-onboarding-vortex-local` passed with 4 files and 13 tests.
- `pnpm run prove:seal-vortex-onboarding-wiring` passed against `dev:clever-goose-484` and `dev:notable-leopard-969`; hosted onboarding reconciled to Vortex, `chargesEnabled: true`, the Seal resolver returned the Vortex merchant account, and the payout profile reported net daily next-day ACH.
- `pnpm run prove:vortex-billing-settings-adoption` passed.
- `pnpm run prove:vortex-payments-settings-adoption` passed.
- `pnpm run prove:vortex-merchant-settings-adoption` passed.
- `pnpm run prove:seal-saas-vortex-local` passed with 2 files and 23 tests.
- `pnpm run prove:seal-catalog-from-vortex` passed against `dev:clever-goose-484` and Vortex `https://notable-leopard-969.convex.site`; synced 16 products and 22 prices and preserved Vortex-shaped entitlement safety.
- `pnpm run prove:seal-coupons-vortex` passed against Vortex public catalog/customer/checkout/coupon APIs; discounted checkout total was 3750 from a 5000 price, invalid promo code created no checkout, and no-code checkout stayed at 5000.
- `pnpm run prove:seal-saas-checkout-vortex` passed against `dev:clever-goose-484` and `dev:notable-leopard-969`; checkout used `pro:monthly:v2`, Vortex price `vtx_price_seal_pro_monthly_v2`, and returned a hosted Vortex `/pay/` URL for 1900.
- A 2026-07-08 live-proof rerun caught and fixed coupon-proof environment drift: the coupon proof temporarily clobbered `VORTEX_BILLING_SAAS_PRICE_MAP`, the non-production `dev:clever-goose-484` map was repaired to include `pro:monthly:v2`, and the patched coupon proof was rerun immediately before `pnpm run prove:seal-saas-checkout-vortex`; both passed, proving coupons no longer break SaaS checkout.
- `pnpm run prove:vortex-saas-webhook-projection` passed with 3 files and 22 tests.
- `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 pnpm run prove:seal-saas-webhook-billing-state` passed after syncing current Convex code; result projected Vortex-shaped customer/subscription/price ids and reported `activeNonVortexProviderIdPresent: false`.
- `pnpm run prove:seal-document-payment-vortex-local` passed.
- `pnpm run prove:vortex-operational-payments-adoption` passed.
- `pnpm run prove:vortex-payments-backend-adapter-adoption` passed.
- `pnpm run prove:seal-vortex-migration-local` passed.
- `pnpm run prove:seal-vortex-migration-local` now includes the Vortex-shaped catalog entitlement safety guard.
- `pnpm run prove:seal-vortex-migration-local` now includes the Vortex proof env-map merge guard, preventing the coupon/checkout/document-payment proof scripts from clobbering existing Vortex map values.
- `pnpm run audit:seal-vortex-hosted-outcomes-boundary` passed.
- `pnpm run audit:seal-vortex-sandbox-settlement-boundary` passed with readiness window still reported as `waiting` and `earliestReconcileAt` preserved as `2026-07-08T18:12:06.10Z`.
- `pnpm run audit:seal-vortex-production-proof-boundary` passed as a non-mutating guard and reported `productionMoneyProofComplete: false`, `postProofRetirementComplete: false`, and `goLiveProofComplete: false` because the checked-in production go-live proof artifact does not exist yet.
- `pnpm run prove:seal-vortex-production-proof-boundary` passed and proved missing, incomplete, money-proof-only, and full go-live proof artifact cases.
- `pnpm run audit:seal-vortex-launch-boundary` passed as a non-mutating guard and now reports `launchReady: false`, waiting on `settlement_proof`, `production_config`, and `production_live_money_proof`, while surfacing the sandbox, production config, production proof, and post-proof retirement boundaries.
- `pnpm run audit:seal-vortex-production-readiness` failed only on the known missing production names listed above and prints the agent-allowed actions, operator-controlled actions, and production success criteria without secret values.
- Branch worktree was clean after the latest recorded verification.

## Current Proof Boundary

Agents may prepare commands, audits, proof harnesses, production config, and non-money Vortex/Seal setup records.

Agents must not run:

- live card payment commands,
- production money movement,
- settlement or payout proof commands that reconcile live money state,
- production document-payment allowlist widening,
- external production webhook retirement,
- remote git push without explicit confirmation.

## Next Action

Work SEA-562:

1. Keep this repo doc and Linear synchronized with current proof.
2. Preserve the exact sandbox settlement command from `docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md`.
3. Run non-mutating local proof gates only:
   - `pnpm run prove:seal-vortex-migration-local`
   - `pnpm run audit:seal-vortex-hosted-outcomes-boundary`
   - `pnpm run audit:seal-vortex-sandbox-settlement-boundary`
   - `pnpm run audit:seal-vortex-production-readiness`
   - `pnpm run audit:seal-vortex-production-proof-boundary`
   - `pnpm run prove:seal-vortex-production-proof-boundary`
   - `pnpm run audit:seal-vortex-launch-boundary`
4. Do not mark launch readiness complete until settled sandbox proof and production proof both pass.
