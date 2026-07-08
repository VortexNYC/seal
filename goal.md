# Seal Vortex Payments Goal

Date: 2026-07-08
Repo: `/Users/shlomokabareti/Projects/Seal`
Base: `origin/staging`
Active branch: `codex/sea-557-provider-neutral-data-contracts`

## Objective

Remove the legacy payment provider from Seal top down and leave Vortex Payments as the only active payment path.

The hard gate is zero active code, package, script, product copy, and non-archived documentation references to the retired provider. Historical archive docs need an explicit keep/delete decision before the final cleanup lane closes.

## Current Truth

- SEA-556 removed executable legacy-provider fallbacks from active payments and Vortex billing paths.
- SEA-557 moved shared provider data contracts to provider-neutral names:
  - merchant accounts
  - payment field provider ids
  - document invoice provider ids
  - organization billing customer ids
  - subscription coupon and promotion ids
- SEA-558 deleted the backend retired-provider runtime:
  - backend provider module tree
  - provider webhook routes
  - provider cron jobs
  - provider account and webhook event tables
  - backend provider package and lockfile entry
  - E2E provider customer seeding
- SEA-559 deleted obsolete proof scripts and root aliases that referenced deleted backend modules.
- SEA-560 is cleaning the remaining active source residue:
  - proof contract names
  - tests and comments
  - landing/product copy
  - package surface ids
  - non-payment UI names that used the retired provider word as visual language

## Proven So Far

- Vortex-hosted SaaS checkout proof exists.
- Vortex subscription webhook projection proof exists.
- Vortex document-payment local proof exists.
- Vortex hosted payable creation harness exists.
- Focused backend projection tests passed after SEA-560 renames:
  - `bun run --cwd apps/backend test convex/vortex_billing/__tests__/webhook_projection.test.ts convex/vortex_billing/__tests__/document_payable_local_proof.test.ts`
  - Result: 2 files, 20 tests passed.

## Not Done

- Full root gates still need to pass after the current SEA-560 edit set:
  - `bun run format:changed:check`
  - `bun run lint:strict`
  - `bun run typecheck`
  - `bun run test`
  - `bun run build`
  - Convex cost guard
- Archive docs still need a final keep/delete decision under SEA-561.
- Live card payment, money movement, settlement, and payout proof remain a human-run boundary.
- No git push is allowed without explicit user confirmation.

## Hard Scanner

Active source gate:

```bash
rg -i "legacy-provider-token" apps packages scripts package.json bun.lock goal.md
```

Before running it, replace `legacy-provider-token` with the retired provider word. The command must return zero active-code/package hits. Do not hide the word through string concatenation to defeat the scanner.

Archive gate:

```bash
rg -i "legacy-provider-token" docs
```

Docs under `docs/archive` may only remain if the final lane records the exception in Linear and the docs are clearly historical.

## Next Action

Finish SEA-560 by running the root gates, update Linear with proof, commit locally, then continue SEA-561 for archive docs and final zero-source scan.
