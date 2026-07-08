# retired provider to Vortex Top-Down Migration

Date: 2026-07-07
Repo: Seal
Control branch: codex/sea-557-provider-neutral-data-contracts
Linear project: Seal retired-provider to Vortex Top-Down Migration

## Objective

Remove retired provider from Seal by walking the product path in order:

1. Account creation
2. Onboarding
3. SaaS billing and subscription state
4. Merchant/payment setup
5. Hosted document-payment surfaces
6. Webhooks, receipts, refunds, payouts, and settlement visibility

The goal is not to rename every historical `retired_provider` field in one pass. The goal is to prevent new retired provider state from being created on the active product path, replace each active retired provider surface with Vortex, then delete legacy retired provider code once proof says it is dead.

## Non-Goals

- No broad `retired_provider` string deletion without proving the caller path.
- No direct Finix dependency from Seal.
- No new provider-specific concepts in core Seal domain state.
- No tax, accounting sync, CRM sync, or PDF polish in this lane.
- No agent-run live money movement. Live sandbox card payment and settlement checks remain a human-run boundary.

## Current Truth

- SaaS billing through Vortex is staging-ready.
- Document-payment Vortex payable creation is locally and sandbox-proven for the current supported path.
- Hosted Vortex payment capture projects into Seal as paid and completes the waiting document.
- Failed hosted payment recovery projects into Seal, starts dunning once, ignores duplicate failures, and cancels dunning after later payment.
- Full retired provider replacement is not launch-ready until settlement/payout visibility and production routing are proven.
- Account/org creation currently anchors Vortex Auth and does not create retired provider state.
- Top-down replacement lanes A through F were completed before the physical deletion phase.
- Physical deletion lanes G through L are complete locally; local proof guard expansion now continues through the current branch head.
- The strict zero-residue scanner checks all tracked paths and file contents for the raw legacy-provider token, including archive docs, and blocks retired-provider alias wording in active guidance/config.
- Stale and completed provider-migration docs now live under `docs/archive/legacy-provider-migration/`; active non-archive retired-provider alias usage is intentionally limited to this migration contract and the residue guard script.
- `bun run prove:vortex-payments-backend-adapter-adoption` is now an executable backend boundary proof, not just a planned command.
- `bun run prove:seal-account-onboarding-vortex-local` is now the non-mutating local account/onboarding proof for account creation, Vortex Auth anchoring, retired merchant-surface blocking, charges-ready merchant resolution, and Vortex payable request mapping.
- `bun run prove:seal-saas-vortex-local` is now the non-mutating local SaaS proof for Vortex checkout, catalog price resolution, coupon application/fail-closed cleanup, portal links, and lifecycle guards.

## Merge Order

Workers can investigate in parallel, but merges must land in this order:

1. Account creation contract
2. Onboarding provider routing
3. SaaS billing lifecycle guardrails
4. Merchant/payment setup
5. Document-payment creation by payment type
6. Hosted payment outcome handling
7. Operational surfaces and retired provider deletion

Lower layers may discover work early, but they do not merge until the layer above has a documented contract and proof.

## Worker Lanes

### Lane A: Account Creation Contract

Scope:

- `apps/web/src/routes/_authenticated/onboarding/choose-organization/index.tsx`
- `apps/backend/convex/organizations/*`
- Vortex Auth organization anchor helpers

Deliverable:

- A written contract proving account creation creates/anchors Vortex Auth state and does not create retired provider customer, subscription, or Connect account state.
- Focused tests or proof script for that contract.

Proof:

- `bun run --cwd apps/backend typecheck`
- Focused backend tests covering organization creation and Vortex Auth anchoring.
- Static grep evidence that account creation does not call `retired_provider` modules.

### Lane B: Onboarding and Merchant Setup

Scope:

- `apps/web/src/routes/_authenticated/$slug/settings/payments.tsx`
- `apps/backend/convex/payments/merchant_account_actions.ts`
- `apps/backend/convex/payments/vortex_merchant_actions.ts`
- retired provider Connect fallbacks reachable from onboarding

Deliverable:

- Vortex-routed onboarding for allowlisted document-payment organizations.
- Legacy retired provider onboarding surfaces blocked for Vortex organizations.
- UI state that does not present retired provider Connect as the Vortex onboarding path.

Proof:

- `bun run --cwd apps/backend test convex/payments/merchant_account_actions.test.ts convex/vortex_billing/payable_actions.test.ts`
- `bun run --cwd apps/backend typecheck`
- `bun run typecheck`
- `bun run prove:seal-vortex-onboarding-wiring` only by the human when it would mutate live sandbox state.

### Lane C: SaaS Billing Lifecycle

Scope:

- SaaS checkout, billing settings, subscription projection, lifecycle guards.
- retired provider customer/subscription creation and seat-sync entry points.

Deliverable:

- SaaS billing path creates Vortex billing state only.
- retired provider lifecycle actions are unavailable on Vortex billing organizations.

Proof:

- `bun run prove:seal-saas-checkout-vortex`
- `bun run prove:seal-saas-webhook-billing-state`
- `bun run prove:seal-saas-vortex-local`
- `bun run prove:vortex-saas-webhook-projection`

### Lane D: Document Payment Creation

Scope:

- Document send/payment-field actions.
- Vortex payable creation for one-time, recurring, installments, and deposit/balance.
- retired provider invoice/subscription/payment-intent writes reachable from sending a document.

Deliverable:

- All real payment types create Vortex payable state without retired provider writes.
- Existing document-payment local proof covers all payment types.

Proof:

- `bun run prove:seal-document-payment-vortex-local`
- Focused backend tests for payment-field config to Vortex payable mapping.
- Live creation proof is human-run only:
  - `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-live`

### Lane E: Hosted Payment Outcomes

Scope:

- Vortex webhook projection.
- Paid, failed, voided, uncollectible, dunning, and document completion state.
- Receipt and failed-payment recovery surfaces.

Deliverable:

- Hosted Vortex payment outcome changes Seal state without retired provider webhook dependency.
- Paid outcome completes waiting documents.
- Failed outcome starts the existing dunning path.

Proof:

- `bun run prove:seal-document-payment-vortex-local`
- `bun run prove:vortex-saas-webhook-projection`
- `bun run prove:seal-vortex-migration-local`
- Human-run paid-state proof after a real sandbox card payment:
  - `SEAL_CONVEX_DEPLOYMENT=dev:clever-goose-484 bun run prove:seal-document-payment-vortex-paid-state`

### Lane F: Operational Surface and Deletion

Scope:

- Merchant payout, settlement, balance, and operational components.
- Remaining retired provider Connect queries/webhooks/schemas after active paths are replaced.

Deliverable:

- Merchant operational surface reads Vortex public settlement/payout/profile data.
- Dead retired provider Connect code is deleted or quarantined behind explicit legacy paths.

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
- `bun run audit:seal-vortex-sandbox-settlement-boundary` statically verifies the captured sandbox payment ids, the Vortex final sandbox launch gate, and the human-run settlement commands without touching Convex, Finix, reconciliation, payouts, or card payment. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
- Production document-payment routing is not configured.
- `bun run audit:seal-vortex-production-readiness` is the no-secret production config gate. The latest agent refresh still fails only on known missing production names without printing secret values: Seal is missing `VORTEX_BILLING_PAYMENTS_ENVIRONMENT` plus the five `VORTEX_BILLING_DOCUMENT_*` routing names; Vortex Payments is missing `VORTEX_PAYMENTS_RUNTIME_MODE` plus the four `FINIX_PRODUCTION_*` names. For values that are present, it validates safe shapes and runtime expectations. The audit prints human-run `convex env set` commands with placeholders for the missing values; agents must not execute those production mutations. If the sibling Vortex checkout is not at `../vortex-payments`, set `VORTEX_PAYMENTS_REPO_ROOT`.
- `bun run audit:seal-vortex-launch-boundary` is the passing non-mutating wrapper for future agent sessions: it verifies the sandbox settlement handoff and then accepts production readiness only when it is green or blocked by the exact known human-run production configuration names. Unexpected missing names or invalid present config fail the wrapper.
- New live proof runs must seed `VORTEX_BILLING_DOCUMENT_*` maps, not shared SaaS maps, so document-payment money routing stays explicit.
- Human-run Vortex proof scripts that call the Vortex Payments checkout accept `VORTEX_PAYMENTS_REPO_ROOT` when the sibling checkout is not at `../vortex-payments`.
- `bun run prove:zero-retired-provider-residue` is the retired-provider residue gate. It keeps dependency-graph and whole-working-tree path checks strict for the raw retired-provider token, requires tracked file contents to contain zero raw retired-provider token, scans the whole working tree outside `.git` for provider-shaped residue, and fails active guidance/config if retired-provider alias wording returns. It intentionally does not fail on unrelated longer words from third-party generated output.
- `bun run prove:seal-vortex-migration-local` is the local non-mutating migration gate for future sessions; it includes the launch-boundary wrapper and the zero-residue gate, and intentionally excludes live card, settlement, payout, production credential, remote git work, and known env-mutating proof commands. The gate statically fails if those commands are added back.
- `bun run verify:seal-vortex-migration` is wired into root `verify` and Vortex Quality CI. Seal intentionally sets `instructionFiles.testEnvExample=false` in `vortex.project.json` because the shared project-kit test-env template is not provider-neutral yet; Seal's checked-in `.test-env.example` stays owned by the zero-residue proof instead.
- The local migration gate also includes `bun run prove:seal-saas-vortex-local`, so SaaS checkout/catalog/coupon/portal/lifecycle replacement cannot drift while document-payment launch proof is waiting on human-boundary settlement and production work.
- The local migration gate also includes `bun run prove:seal-account-onboarding-vortex-local`, so the top-of-funnel account/onboarding contract is covered by the same one-command proof.
- `bun run audit:seal-vortex-hosted-outcomes-boundary` statically preserves the checked-in hosted outcome proof artifact: paid Vortex capture, Seal paid projection, failed recovery, duplicate failed idempotency, stale failed ignore-after-paid behavior, dunning cancellation, and the unsettled-money go-live boundary.

Do next:

1. Keep `goal.md`, this plan, and Linear synchronized.
2. Preserve the exact human-run settlement proof command from `docs/test-sessions/session-2026-07-07-seal-document-payment-vortex-live.md`.
3. Run only non-mutating local gates as agent proof:
   - `bun run prove:seal-vortex-migration-local`
   - `bun run audit:seal-vortex-hosted-outcomes-boundary`
   - `bun run audit:seal-vortex-sandbox-settlement-boundary`
   - `bun run audit:seal-vortex-production-readiness`
   - `bun run audit:seal-vortex-launch-boundary`
4. When the provider settlement readiness window is open, a human runs the settlement command and the paid-state proof with `--require-settled`.
5. Production launch remains blocked until production credentials, document-payment routing maps, one small real payment, and real settlement/payout visibility are proven.

Do not run live card, settlement, payout, production credential, or remote push commands as an agent.
