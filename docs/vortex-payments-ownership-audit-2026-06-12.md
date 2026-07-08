# Vortex Payments Ownership Audit - 2026-06-12

## Verdict

Seal has moved its user-facing billing and merchant payment surfaces behind the Vortex Payments boundary.

The migration is not "off Stripe" at the processor layer. Stripe is still the current processor adapter for hosted checkout, billing portal, Connect onboarding, invoices, webhooks, and processor IDs. That is acceptable only if Stripe stays behind `api.payments.*` and `apps/backend/convex/stripe/*`, never in Seal web routes or user-facing payment UI ownership.

## Seal Owns

- Product routes, workspace routing, and authenticated layout.
- Seal-specific copy, plan packaging, and feature labels shown inside Vortex components.
- Document workflow decisions: when a payment field is required, when signing can continue, and how a document references a Vortex-hosted payment handoff.
- Organization permissions and who may manage billing or merchant settings.

## Vortex Payments Owns

- Billing facade actions and queries exposed to Seal as `api.payments.*`.
- Merchant account state and operational payment projections exposed through Vortex components.
- Vortex React components from `@vortex/payments/react`: plan comparison, subscription summary, merchant account panel, action queue, fee policy panel, balance, payout, and timeline surfaces.
- Provider handoff naming at the product boundary: users see Vortex checkout, Vortex Connect, Vortex actions, and Vortex-owned operational states.

## Processor Adapter Owns

- Stripe SDK calls while Stripe remains the current processor.
- Stripe checkout session creation, billing portal session creation, Connect account/session/link creation, webhooks, and payment object creation.
- Stripe-specific IDs and webhook event projections.

The adapter boundary is currently in `apps/backend/convex/stripe/*`. The browser must not pass processor account IDs or import Stripe provider APIs directly.

## Current Leaks To Keep Hammering

- `apps/backend/convex/payments/subscription_actions.ts` still carries Stripe compatibility names for internal generated APIs and existing org customer fields, but it no longer imports or constructs the Stripe SDK. Hosted checkout, billing portal, and subscription mutation calls now delegate to `apps/backend/convex/stripe/subscription_processor.ts`.
- Core persisted tables and fields still carry Stripe names such as `stripe_accounts`, `stripeCustomerId`, `stripeInvoiceId`, and `stripeSubscriptionId`. Keep them while they are existing data contracts, but new Vortex-facing code should use processor/provider-neutral names at the boundary.
- E2E helpers still say `seedStripeCustomerForE2E` because the current processor is Stripe. That is acceptable for adapter tests; Vortex-facing tests should assert Vortex behavior, not Stripe labels.

## Proved Today

- Seal billing settings render through `@vortex/payments/react` and `api.payments.billing_queries`.
- Billing portal and checkout are both reachable through `api.payments.subscription_actions`.
- New/free organizations no longer fail customer portal creation just because `organizations.stripeCustomerId` is empty.
- Merchant settings render Vortex Connect and Vortex fee policy surfaces.
- Operational routes render Vortex surfaces or Vortex no-account states for payments overview, balances, payouts, history, disputes, tax, and subscriptions.
- The full billing E2E dependency chain passes after fixing seeded API document ownership in the E2E Convex helpers.
- E2E Convex deployment `clever-goose-484` has the seeded document fix and Vortex Payments adapter boundary.
- Staging web proof is live at `https://staging-app.seal.nyc` through Cloudflare Worker `seal-web-staging`, built against `clever-goose-484`.
- Staging browser proof passes for billing settings, Vortex Connect settings, and payments overview, balances, payouts, history, disputes, tax, and subscriptions.

## Proof Command Rules

- Run Vortex SaaS webhook projection tests through the root proof script: `bun run prove:vortex-saas-webhook-projection`.
- Do not run `bun test apps/backend/convex/vortex_billing/__tests__/webhook_projection.test.ts` directly. That bypasses Vitest/Vite and fails before test execution because the Convex test harness depends on `import.meta.glob`; raw Bun reports `TypeError: import.meta.glob is not a function` from `@convex-dev/action-retrier/src/test.ts`.

## Remaining Blockers

- Full provider independence still requires a later data-contract migration from persisted `stripe*` field names to provider-neutral names.
