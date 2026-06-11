# Seal Billing Vortex Components Proof — 2026-06-11

## Scope

Seal billing settings route consuming `@vortex/payments/react` through the Vortex Payments subscription summary and plan comparison components.

## Result

- PASS: Better Auth sign-in completed for `seal-e2e@seal.nyc` after adding explicit local trusted origins for `localhost:4542` and `127.0.0.1:4542`.
- PASS: `/seal-e2e/settings/billing` rendered the Vortex subscription summary with the current Free plan state.
- PASS: The Vortex plan comparison rendered Free as current and Seal Professional as selectable at `usd 19.00` per month.
- PASS: Selecting Seal Professional redirected to Stripe Checkout test mode for `Subscribe to Seal Professional` at `$19.00` per month.

## Evidence

- Browser tool: `vb --fresh seal-billing-proof`
- Local app URL: `http://localhost:4542`
- Product route: `http://localhost:4542/seal-e2e/settings/billing`
- Local screenshots and raw session JSON were captured under ignored `docs/test-sessions/`.

## Notes

- `http://seal.localhost:1355` returned 502 during this proof while the product-only Vite app was healthy on `localhost:4542`.
- Browser sign-in initially hung because the Better Auth response did not emit `Access-Control-Allow-Origin` for `http://localhost:4542`; direct curl sign-in succeeded, which isolated the failure to browser CORS.
