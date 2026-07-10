# Legacy Payment Provider to Vortex Top-Down Migration

Date: 2026-07-07
Repo: Seal
Control branch: codex/sea-557-provider-neutral-data-contracts
Linear project: Seal legacy-payment-provider to Vortex Top-Down Migration

## Objective

Remove the legacy payment provider from Seal by walking the product path in order:

1. Account creation
2. Onboarding
3. SaaS billing and subscription state
4. Merchant/payment setup
5. Hosted document-payment surfaces
6. Webhooks, receipts, refunds, payouts, and settlement visibility

The goal is not to rename every historical legacy-provider field in one pass. The goal is to prevent new legacy-provider state from being created on the active product path, replace each active legacy payment surface with Vortex, then delete legacy payment-provider code once proof says it is dead.

## Non-Goals

- No broad legacy-provider token deletion without proving the caller path.
- No direct Finix dependency from Seal.
- No new provider-specific concepts in core Seal domain state.
- No tax, accounting sync, CRM sync, or PDF polish in this lane.
- No hidden live money movement in local gates. Live card payment, settlement reconciliation, and payout proof remain explicit operator actions outside local proof commands.

## Current Truth

- SaaS billing through Vortex is staging-ready.
- Document-payment Vortex payable creation is locally and sandbox-proven for the current supported path.
- Hosted Vortex payment capture projects into Seal as paid and completes the waiting document.
- Failed hosted payment recovery projects into Seal, starts dunning once, ignores duplicate failures, and cancels dunning after later payment.
- Full legacy payment-provider replacement is not launch-ready until settlement/payout visibility and production routing are proven.
- Account/org creation currently anchors Vortex Auth and does not create legacy payment-provider state.
- Top-down replacement lanes A through F were completed before the physical deletion phase.
- Physical deletion lanes G through L are complete locally; local proof guard expansion now continues through the current branch head.
- The strict zero-residue scanner checks all tracked paths and file contents for the raw legacy-provider token, including archive docs, and blocks old-provider alias wording in active guidance, config, and this current plan.
- Stale and completed provider-migration docs now live under `docs/archive/legacy-provider-migration/`; active non-archive legacy-provider discussion is intentionally limited to current migration contracts and proof scripts.
- `bun run prove:vortex-payments-backend-adapter-adoption` is now an executable backend boundary proof, not just a planned command.
- `bun run prove:seal-account-onboarding-vortex-local` is now the non-mutating local account/onboarding proof for account creation, Vortex Auth anchoring, legacy merchant-surface blocking, charges-ready merchant resolution, and Vortex payable request mapping.
- `bun run prove:seal-saas-vortex-local` is now the non-mutating local SaaS proof for Vortex checkout, catalog price resolution, coupon application/fail-closed cleanup, portal links, and lifecycle guards.
- `bun run audit:seal-vortex-production-proof-boundary` keeps production live-money proof and post-proof external residue retirement as explicit launch blockers until a checked-in production proof artifact exists.
- `bun run prove:seal-vortex-production-proof-boundary` proves missing, malformed, money-proof-only, and full go-live production proof artifact states, so a bad production proof note cannot silently satisfy launch readiness.

## Merge Order

Workers can investigate in parallel, but merges must land in this order:

1. Account creation contract
2. Onboarding provider routing
3. SaaS billing lifecycle guardrails
4. Merchant/payment setup
5. Document-payment creation by payment type
6. Hosted payment outcome handling
7. Operational surfaces and legacy provider deletion

Lower layers may discover work early, but they do not merge until the layer above has a documented contract and proof.

## Worker Lanes

### Lane A: Account Creation Contract

Scope:

- `apps/web/src/routes/_authenticated/onboarding/choose-organization/index.tsx`
- `apps/backend/convex/organizations/*`
- Vortex Auth organization anchor helpers

Deliverable:

- A written contract proving account creation creates/anchors Vortex Auth state and does not create legacy-provider customer, subscription, or Connect account state.
- Focused tests or proof script for that contract.

Proof:

- `bun run --cwd apps/backend typecheck`
- Focused backend tests covering organization creation and Vortex Auth anchoring.
- Static grep evidence that account creation does not call legacy payment-provider modules.

### Lane B: Onboarding and Merchant Setup

Scope:

- `apps/web/src/routes/_authenticated/$slug/settings/payments.tsx`
- `apps/backend/convex/payments/merchant_account_actions.ts`
- `apps/backend/convex/payments/vortex_merchant_actions.ts`
- legacy provider Connect fallbacks reachable from onboarding

Deliverable:

- Vortex-routed onboarding for allowlisted document-payment organizations.
- Legacy provider onboarding surfaces blocked for Vortex organizations.
- UI state that does not present legacy provider Connect as the Vortex onboarding path.

Proof:

- `bun run --cwd apps/backend test convex/payments/merchant_account_actions.test.ts convex/vortex_billing/payable_actions.test.ts`
- `bun run --cwd apps/backend typecheck`
- `bun run typecheck`
- `bun run prove:seal-vortex-onboarding-wiring` only with explicit live-sandbox mutation intent.

### Lane C: SaaS Billing Lifecycle

Scope:

- SaaS checkout, billing settings, subscription projection, lifecycle guards.
- legacy provider customer/subscription creation and seat-sync entry points.

Deliverable:

- SaaS billing path creates Vortex billing state only.
- legacy provider lifecycle actions are unavailable on Vortex billing organizations.

Proof:

- `bun run prove:seal-saas-checkout-vortex`
- `bun run prove:seal-saas-webhook-billing-state`
- `bun run prove:seal-saas-vortex-local`
- `bun run prove:vortex-saas-webhook-projection`

### Lane D: Document Payment Creation

Scope:

- Document send/payment-field actions.
- Vortex payable creation for one-time, recurring, installments, and deposit/balance.
- legacy provider invoice/subscription/payment-intent writes reachable from sending a document.

Deliverable:

- All real payment types create Vortex payable state without legacy provider writes.
- Existing document-payment local proof covers all payment types.

Proof:

- `bun run prove:seal-document-payment-vortex-local`
- Focused backend tests for payment-field config to Vortex payable mapping.
- Live creation proof is an explicit operator action:
  - `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live`

### Lane E: Hosted Payment Outcomes

Scope:

- Vortex webhook projection.
- Paid, failed, voided, uncollectible, dunning, and document completion state.
- Receipt and failed-payment recovery surfaces.

Deliverable:

- Hosted Vortex payment outcome changes Seal state without legacy provider webhook dependency.
- Paid outcome completes waiting documents.
- Failed outcome starts the existing dunning path.

Proof:

- `bun run prove:seal-document-payment-vortex-local`
- `bun run prove:vortex-saas-webhook-projection`
- `bun run prove:seal-vortex-migration-local`
- Paid-state proof after a real sandbox card payment:
  - `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-paid-state`

### Lane F: Operational Surface and Deletion

Scope:

- Merchant payout, settlement, balance, and operational components.
- Remaining legacy provider Connect queries/webhooks/schemas after active paths are replaced.

Deliverable:

- Merchant operational surface reads Vortex public settlement/payout/profile data.
- Dead legacy provider Connect code is deleted or quarantined behind explicit legacy paths.

Proof:

- `bun run prove:vortex-operational-payments-adoption`
- `bun run prove:vortex-payments-backend-adapter-adoption`
- `bun run typecheck`
- `bun run lint`
- `bun run build`

## Control Rules

- One Linear issue per lane.
- One worker branch per lane.
- One proof command listed on every worker issue.
- Workers must leave a short handoff comment with files changed, proof run, remaining blockers, and whether live proof is required.
- Control thread owns merge order and resolves cross-lane conflicts.
- Do not run broad `bun test` as a completion gate until the existing web test environment failures are separated; focused tests plus root typecheck/lint/build are the current merge gate.

## Immediate Next Action

Phase 2 physical deletion is locally complete.

The current lane is `SEA-562`: prove the remaining document-payment launch boundary without pretending code deletion equals launch readiness.

### Phase 3: Settlement and Production Readiness

Current launch baseline:

- SaaS Vortex path is green.
- Document payable creation is green.
- Hosted document payment capture and Seal paid-state projection are green in sandbox.
- Failed-payment recovery is green in sandbox.
- Settled document-payment money movement is still waiting on provider settlement readiness.
- `bun run audit:seal-vortex-sandbox-settlement-boundary` statically verifies the captured sandbox payment ids, the Vortex final sandbox launch gate, and settlement commands without touching Convex, Finix, reconciliation, payouts, or card payment. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
- Production document-payment routing is configured for the MCP production workspace only: Seal prod now has `VORTEX_BILLING_PAYMENTS_ENVIRONMENT=production`, document allowlist `jd79vzsynmb6absn1f9adpa4t987x1tz`, document customer/account/merchant maps to the existing Vortex production records, and `VORTEX_BILLING_DOCUMENT_PRICE_ID=vtx_price_seal_prod_mcp_document_one_time_20260708`.
- `bun run audit:seal-vortex-production-readiness` is the no-secret production config gate. The latest agent refresh now has Seal production green and Vortex public production config green; Vortex Payments still lacks only `FINIX_PRODUCTION_USERNAME`, `FINIX_PRODUCTION_PASSWORD`, `FINIX_PRODUCTION_APPLICATION_ID`, and `FINIX_PRODUCTION_WEBHOOK_SECRET`. For values that are present, it validates safe shapes and runtime expectations. The audit prints exact `convex env set` command shapes with placeholders for missing values. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
- `bun run audit:seal-vortex-production-proof-boundary` is the static production proof gate. It reports `status: waiting_for_production_money_proof` until `docs/test-sessions/session-2026-07-08-seal-vortex-production-go-live.md` records production money proof and post-proof external residue retirement evidence.
- `bun run prove:seal-vortex-production-proof-boundary` is the local self-proof for that static gate. It proves missing, incomplete, money-proof-only, and full go-live proof artifact cases.
- `bun run audit:seal-vortex-launch-boundary` is the passing non-mutating wrapper for future agent sessions: it verifies hosted outcome projection, preserves the sandbox settlement handoff, reports `launchReady: false` while fully settled evidence, production config, production money proof, or post-proof retirement evidence is missing, and accepts production readiness only when it is green or blocked by the exact known production configuration names. Unexpected missing names, invalid present config, or malformed production proof artifacts fail the wrapper.
- New live proof runs must seed `VORTEX_BILLING_DOCUMENT_*` maps, not shared SaaS maps, so document-payment money routing stays explicit.
- Vortex proof scripts that call the Vortex Payments checkout accept `VORTEX_PAYMENTS_REPO_ROOT` when the sibling checkout is not at `../vortex-payments`.
- `bun run prove:zero-retired-provider-residue` is the legacy payment-provider residue gate. It keeps dependency-graph and whole-working-tree path checks strict for the raw legacy-provider token, requires tracked file contents to contain zero raw legacy-provider token, scans the whole working tree outside `.git` for provider-shaped residue, and fails active guidance/config/current-plan files if old-provider alias wording returns outside approved proof command names. It intentionally does not fail on unrelated longer words from third-party generated output.
- `bun run prove:seal-vortex-migration-local` is the local non-mutating migration gate for future sessions; it includes the launch-boundary wrapper and the zero-residue gate, and intentionally excludes live card, settlement, payout, production credential, remote git work, and known env-mutating proof commands. The gate statically fails if those commands are added back.
- The local migration gate also statically checks that the env-mutating Vortex catalog proof seeds Vortex-shaped entitlement safety controls only; the obsolete non-Vortex-provider-shaped catalog safety control is gone from active proof code.
- `bun run verify:seal-vortex-migration` is wired into root `verify` and Vortex Quality CI. Seal intentionally sets `instructionFiles.testEnvExample=false` in `vortex.project.json` because the shared project-kit test-env template is not provider-neutral yet; Seal's checked-in `.test-env.example` stays owned by the zero-residue proof instead.
- The local migration gate also includes `bun run prove:seal-saas-vortex-local`, so SaaS checkout/catalog/coupon/portal/lifecycle replacement cannot drift while document-payment launch proof is waiting on settlement and production work.
- The local migration gate also includes `bun run prove:seal-account-onboarding-vortex-local`, so the top-of-funnel account/onboarding contract is covered by the same one-command proof.
- `bun run audit:seal-vortex-hosted-outcomes-boundary` statically preserves the checked-in hosted outcome proof artifact: paid Vortex capture, Seal paid projection, failed recovery, duplicate failed idempotency, stale failed ignore-after-paid behavior, dunning cancellation, and the unsettled-money go-live boundary.
- Remote review is not open yet: inspect the current local-vs-staging count with `git rev-list --left-right --count origin/staging...HEAD`; `origin/codex/sea-557-provider-neutral-data-contracts` does not exist, and no open PR exists for this branch. PR #480 is merged historical work and is not the active review vehicle for the current proof-boundary head.

Do next:

1. Keep `goal.md`, this plan, and Linear synchronized.
2. Preserve the exact settlement proof command from `docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md`.
3. Do not assume PR #480 covers this branch; remote push and PR creation require explicit confirmation.
4. Run only non-mutating local gates as agent proof:
   - `bun run prove:seal-vortex-migration-local`
   - `bun run audit:seal-vortex-hosted-outcomes-boundary`
   - `bun run audit:seal-vortex-sandbox-settlement-boundary`
   - `bun run audit:seal-vortex-production-readiness`
   - `bun run audit:seal-vortex-production-proof-boundary`
   - `bun run prove:seal-vortex-production-proof-boundary`
   - `bun run audit:seal-vortex-launch-boundary`
5. When the provider settlement readiness window is open, run the settlement command and the paid-state proof with `--require-settled`.
6. Production launch remains blocked until production credentials, document-payment routing maps, one small real payment, and real settlement/payout visibility are proven.

Do not run live card, settlement, payout, production credential, or remote push commands as an agent.
