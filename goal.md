# Seal Vortex Payments Goal

Date: 2026-07-08
Repo: `/Users/shlomokabareti/Projects/Seal`
Base: `origin/staging`
Active branch: `codex/sea-557-provider-neutral-data-contracts`
Local head: inspect with `git rev-parse --short HEAD` before acting.
Linear control: `SEA-555`
Current lane: `SEA-562`

## Objective

Remove the retired payment provider from Seal top down and leave Vortex Payments as the only active payment path.

This has two separate gates:

1. Code deletion gate: no tracked code, packages, scripts, config, product copy, or docs contain the retired provider token.
2. Launch-readiness gate: Vortex Payments proves the active Seal paths end to end, including hosted payment outcomes, settlement visibility, and production routing boundaries.

Do not collapse these gates. Code deletion can be green while launch readiness is still proof-gated.

## Current Truth

- SEA-556 through SEA-561 are complete locally on `codex/sea-557-provider-neutral-data-contracts`.
- The strict residue guard scans every tracked file with no archive exception.
- `git ls-files | rg -i "<retired-provider-token>"` returns no matches when the placeholder is replaced with the actual retired provider word.
- Raw working-tree scan excluding generated/ignored outputs returns no matches.
- `bun run prove:seal-vortex-migration-local` is the local non-mutating migration gate that composes residue, account/onboarding guards, settings, SaaS checkout/catalog/coupon/portal proofs, webhook projection, backend adapter, operational surface, document-payment local proofs, sandbox settlement handoff, and launch-boundary drift detection.
- Full root quality gates passed after the strict cleanup:
  - `bun run format:changed:check`
  - `bun run lint:strict`
  - `bun run typecheck`
  - `bun run test`
  - `bun run build`
  - `bun /Users/shlomokabareti/.codex/tools/convex-cost-guard.ts`
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

## Not Done

- The local branch has not been pushed or merged.
- Sandbox document-payment settlement is not proven fully settled yet.
- `bun run audit:seal-vortex-sandbox-settlement-boundary` preserves the captured sandbox payment ids, the Vortex final sandbox launch gate, and human-run settlement commands without calling Convex, Finix, or reconciliation. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
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

Current result: failing, as expected, without printing secret values.
The audit checks required production names plus safe value shape/runtime expectations for any values that are present. It also prints a human-run remediation checklist with exact deployment-scoped `convex env set` commands and placeholders for the missing values. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`. Agents must not execute those commands against production.

Non-mutating launch-boundary wrapper:

```bash
bun run audit:seal-vortex-launch-boundary
```

This wrapper passes only when the sandbox settlement handoff is intact and production readiness is either green or blocked only by the known human-run production configuration names listed below. It fails on invalid present production config or unexpected missing env names.

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

## Current Human Boundary

Agents may prepare commands, audits, and proof harnesses.

Agents must not run:

- live card payment commands,
- production credential mutation,
- production money movement,
- settlement or payout proof commands that reconcile live money state,
- remote git push without explicit confirmation.

## Next Action

Work SEA-562:

1. Keep this repo doc and Linear synchronized with current proof.
2. Preserve the exact human-run sandbox settlement command from `docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md`.
3. Run non-mutating local proof gates only:
   - `bun run prove:seal-vortex-migration-local`
   - `bun run audit:seal-vortex-sandbox-settlement-boundary`
   - `bun run audit:seal-vortex-production-readiness`
   - `bun run audit:seal-vortex-launch-boundary`
4. Do not mark launch readiness complete until settled sandbox proof and production proof both pass.
