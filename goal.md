# Seal Vortex Payments Goal

Date: 2026-07-08
Repo: `/Users/shlomokabareti/Projects/Seal`
Base: `origin/staging`
Active branch: `codex/sea-557-provider-neutral-data-contracts`
Local head: `800dbab9`
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
- Merchant onboarding and settings paths route through Vortex-owned actions for Vortex document-payment organizations.
- SaaS checkout, subscription webhook projection, catalog, and coupon paths are Vortex-backed.
- Document payable creation through Vortex is proven locally and in sandbox for the current supported path.
- Hosted Vortex payment capture has projected into Seal as paid and completed the waiting document.
- Failed hosted payment recovery is proven: failed outcome marks the invoice uncollectible, starts dunning once, ignores duplicate failures, and cancels dunning after a later paid event.

## Not Done

- The local branch has not been pushed or merged.
- Sandbox document-payment settlement is not proven fully settled yet.
- Production Vortex document-payment routing is not configured.
- Production real-money proof is not complete.
- Widening the document-payment allowlist and retiring external production webhooks is blocked until production proof passes.

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
   - `bun run prove:zero-retired-provider-residue`
   - `bun run prove:seal-document-payment-vortex-local`
4. Do not mark launch readiness complete until settled sandbox proof and production proof both pass.
