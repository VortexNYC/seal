# retired provider to Vortex Top-Down Migration

Date: 2026-07-07
Repo: Seal
Control branch: codex/seal-vortex-document-payment-proof
Linear project: Seal retired provider to Vortex Top-Down Migration

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
- Document-payment Vortex payable creation is locally and sandbox-proven for the one-time path.
- Full retired provider replacement is not launch-ready until paid hosted checkout, webhook projection, platform fee movement, and merchant settlement/payout visibility are tied together.
- Account/org creation currently anchors Vortex Auth and does not create retired provider state.
- The first active top-down retired provider leak found after account creation is merchant onboarding: legacy retired provider Connect OAuth/session actions were still callable.
- First guard cut is local on this branch: Vortex document-payment organizations are blocked from retired provider OAuth onboarding, OAuth exchange, and embedded account sessions.

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
- `bun run prove:seal-saas-retired_provider-lifecycle-guard`
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

Previous replacement lanes A through F are complete and merged through PR #480. The next phase is physical retired provider deletion.

### Phase 2: Physical retired provider Deletion

Current residue baseline after PR #480:

- 151 files contain retired provider strings.
- 29 files remain under `apps/backend/convex/retired_provider`.
- `apps/backend/package.json` still depends on `retired_provider`.
- `apps/backend/convex/payments/*` still contains legacy `internal.retired_provider.*` fallbacks.
- Persisted schema and historical fields still contain retired provider-shaped names such as `retired_providerCustomerId`, `retired_provider_accounts`, `retired_providerInvoiceId`, and `retired_providerSubscriptionId`.

Deletion order:

1. Clean baseline and proof gates.
2. Remove executable retired provider provider calls from account creation, onboarding, SaaS billing, merchant setup, document payments, and operations.
3. Migrate retired provider-shaped data contracts to provider-neutral names.
4. Delete retired provider webhook, catalog sync, subscription processor, Connect, invoice/payment-field, coupon, and revenue modules.
5. Remove retired provider package/env/runtime config.
6. Rename or delete tests/proofs that only exist to guard the old retired provider transition.
7. Clean docs/archive residue or explicitly move historical notes outside the active codebase.
8. Add a hard zero-retired provider scanner gate.

Hard completion gate:

- `rg -i "retired_provider" apps packages scripts docs package.json bun.lock*` must be zero for active code/package surfaces.
- `find apps/backend/convex/retired_provider -type f` must fail because the directory is gone.
- `bun run format:changed:check`
- `bun run lint:strict`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run prove:vortex-payments-backend-adapter-adoption`
- `bun run prove:vortex-operational-payments-adoption`
- `bun run prove:seal-document-payment-vortex-local`
- `bun run prove:vortex-saas-webhook-projection`

Live sandbox card payment, settlement, and payout proof remains human-run. The code must prepare the proof boundary, but agents do not move live money.

Immediate next action:

Create Linear phase-2 deletion lanes, then start the executable provider deletion lane. Do not start with docs. Deleting docs first makes the scanner look better while the product still has retired provider runtime code.

Historical immediate action from phase 1:

- Lane A proves account creation is retired provider-free.
- Lane B finishes onboarding and merchant setup replacement.

After those two are stable, dispatch Lane C and Lane D.
