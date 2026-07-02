# Slice 1b-S — Wire Seal to Vortex hosted onboarding (start-link → hosted KYC → charges-ready)

**Context:** Vortex-side onboarding is complete + live-proven (1b-V.1 API path, 1b-V.2 hosted KYC form, 1b-V.3 public `POST /v1/merchant-accounts/:id/onboarding-link`). Seal 1a already provisions a minimal Vortex merchant per allowlisted org (`vortex_merchant_actions.ts createVortexMerchantAccount` via raw HTTP + `apiKey`), stores `vortexMerchantAccountId`/`chargesEnabled` on the org's `stripe_accounts` row, and `getVortexMerchantAccountIdForOrg` returns the id ONLY when `chargesEnabled`. So per-user routing already flips on at charges-ready — Seal just can't get a merchant THERE yet (no way to start onboarding).

**Goal:** let a Seal user complete KYC via the Vortex-hosted page and reach charges-ready, so their document payments route to their own Vortex merchant. **Seal calls the Vortex PUBLIC API only — never Finix.**

## Scope
1. **Action** `createVortexOnboardingLink(organizationId)` in `vortex_merchant_actions.ts`: resolve the org's `vortexMerchantAccountId` → `POST /v1/merchant-accounts/:id/onboarding-link` (raw HTTP, mirror the existing request helper + `apiKey`) → return `{ url, onboardingSessionId, expiresAt }`. Persist `onboardingSessionId` on the row if useful. Guard: org must have a Vortex merchant (create first if missing).
2. **Settings UI** (`apps/web/src/routes/_authenticated/$slug/payments/index.tsx`, whichever renders Vortex merchant status): when the org's Vortex merchant is NOT `chargesEnabled`, show a "Complete verification" CTA that calls the action and opens the returned hosted URL (new tab). When `chargesEnabled`, show verified/active. Reuse existing status display + button components.
3. **Charges-ready sync**: on settings load / on return, call the existing `refreshVortexMerchantAccount` to sync `chargesEnabled` from Vortex `/state`; per-user routing then activates automatically (1a resolver).
4. **Boundary gate**: Seal has ZERO direct Finix (`rg -n 'finix|payments-provider' apps` = none but @vortexnyc references). Add/keep as a checked invariant.

## Central questions for Codex (validate against BOTH repos)
- CQ1: Raw HTTP (mirror 1a) vs `@vortexnyc/payments-sdk@0.1.0` — does the installed SDK have an onboarding-link method (it predates 1b-V.3)? If not, raw HTTP is the lean path; flag adding it to the SDK as a follow-up.
- CQ2: Exact UI location + the existing Vortex merchant-status component the CTA hangs off. Don't build a new panel if one exists.
- CQ3: Proof scope without theater: full cross-repo drive-to-charges-ready from Seal (Seal action → Vortex dev → hosted KYC → refresh → Seal sees chargesEnabled + routing resolves), OR Seal-integration (link returned + refresh reflects state) leaning on the Vortex-side proof for the charges-ready leg? Recommend the honest minimum.
- CQ4: How does Seal learn charges-ready — poll `refreshVortexMerchantAccount` on settings load (simple), or is there/should there be a Vortex→Seal merchant-state webhook? Is poll-on-load enough for 1b-S?

## Out of scope
- 1c payout (liability-gated), 1d Stripe Connect deletion + table rename, SDK onboarding-link method (follow-up).

## Gates
Seal from ROOT: typecheck/lint/build/test. Boundary grep = zero direct Finix. Cross-repo proof green (vs Vortex dev). Codex reviews this plan (CQ1-CQ4) then the diff.

---
## REVISED per Codex plan-review (2026-07-02, `~/seal-1bS-plan-review.txt`; verdict REVISE)
CQ answers: SDK 0.1.0 has NO onboarding-link → raw HTTP correct (mirror `requestVortexBillingJson`). CTA home is `apps/web/src/routes/_authenticated/$slug/settings/payments.tsx` (extend existing Vortex Connect panel @188/224, NOT operational `payments/*`). Charges-ready via existing `refreshMerchantAccount` (already provider-branched, merchant_account_actions.ts:127) polled on load — NO webhook. Boundary confirmed clean.

**Architecture correction (do this, not the orphan action):**
1. Make the EXISTING public action `payments/merchant_account_actions.createMerchantOnboardingLink` (merchant_account_actions.ts:65, currently always Stripe) **provider-aware** — allowlisted/Vortex orgs route to a new Vortex helper; others keep Stripe. Mirrors 1a's `createMerchantAccount` provider split. The existing UI CTA that calls this action then works for both.
2. New internal helper `createVortexOnboardingLink` in `vortex_merchant_actions.ts` using `requestVortexBillingJson` (apiBaseUrl + apiKey) → `POST /v1/merchant-accounts/:id/onboarding-link` → returns `{ url, onboardingSessionId, expiresAt }`. Boundary: Vortex public API only.
3. **UI**: extend the existing Vortex Connect panel in `settings/payments.tsx` — when the org's Vortex merchant is not `chargesEnabled`, the existing/CTA opens the returned hosted URL (new tab). When ready, show active. Do NOT build a new panel.
4. **Charges-ready**: existing `refreshMerchantAccount` (provider-branched) on settings load/return syncs `chargesEnabled`; 1a resolver flips per-user routing. No webhook.
5. **Proof**: full cross-repo drive-to-charges-ready from Seal against Vortex DEV `dev:notable-leopard-969` (NOT prod) — Seal action returns hosted URL → hosted KYC completes on Vortex dev → Seal `refreshMerchantAccount` reads `/state` → Seal stores `chargesEnabled` → routing resolver returns the merchant id.
