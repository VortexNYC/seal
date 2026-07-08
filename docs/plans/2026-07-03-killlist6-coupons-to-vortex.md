# Kill-list #6 — Wire Seal coupons/promo codes to Vortex discounts

**Why:** Seal resolves coupons/promo codes via retired provider (`retired_provider/coupon.ts`, `promo_code.ts`, `actions.ts`; webhook-synced coupons/promotion_codes tables). Seal's Vortex SaaS checkout (`vortex_billing_processor.ts`) passes NO discount today. Vortex exposes the full coupon lifecycle (`discountsHttp`: list/apply/terminate/create). Wire Seal's Vortex checkout to apply a promo code via Vortex so discounts work off retired provider. Boundary: Seal → Vortex public API only.

## Grounding
- Seal Vortex checkout: `vortex_billing_processor.ts` builds `seal-saas-checkout:{org}:{lookupKey}` → priceId (priceMap) → Vortex checkout session (returns checkoutUrl). No coupon/discount field.
- Vortex apply model: `discountsHttp.applyCoupon(couponId)` = POST `/v1/coupons/{couponId}/apply` with body incl. `customerExternalId`; checks `listAppliedCoupons` for the customer; coupons are applied to a CUSTOMER (not inline at checkout). `discountType: fixed_amount | percentage`. Routes: `couponsList` GET/POST; `couponsPrefix` POST (apply/terminate) / GET.
- Seal coupon tables (retired provider-sourced): coupons / promotion_codes (webhook upserts). Live retired provider checkout uses them.

## Open questions for Codex (must answer before build)
- CQ1: Exact Vortex apply model — does applying a coupon to a customer (`applyCoupon` {couponId, customerExternalId}) make a SUBSEQUENT Vortex checkout/subscription for that customer reflect the discount automatically? Or must the checkout/subscription-create call itself reference the coupon? Trace `billingEngine` apply + how checkout/subscription consumes applied coupons. This determines the wiring point.
- CQ2: Promo code vs coupon — Vortex `couponId` vs a user-facing PROMO CODE. Is there a Vortex promo-code→coupon resolution (like retired provider promotionCodes→coupon), or does Seal map the entered code → couponId? Cite the discount resources.
- CQ3: Validation/UX — to validate a code before checkout (show discount), does Seal call Vortex `getCoupon`/list, or a validate endpoint? What's returned (amount/percent, active, expiry, redemption limits)?
- CQ4: Do we need to SYNC Vortex coupons into Seal (like #7 catalog) for display/validation, or resolve on-demand at checkout? Recommend simplest correct.
- CQ5: MONEY-PATH RISK — a mis-applied/failed coupon must FAIL CLOSED (never silently charge full or silently skip). Existing retired provider coupon path must stay intact (additive/provider-aware). Confirm no regression to live retired provider checkout.
- CQ6: Boundary — Seal → Vortex public coupon API via requestVortexBillingJson only; no Finix.

## Likely scope (pending CQ answers)
1. Seal: at Vortex checkout, accept an optional promo/coupon code → resolve to Vortex couponId → apply via Vortex (applyCoupon to the customer, or pass to checkout — per CQ1) BEFORE the subscription is created → discount reflected.
2. Validation helper (Seal → Vortex getCoupon/list) for pre-checkout display + fail-closed on invalid/expired.
3. Keep retired provider coupon path intact; provider-aware (Vortex-billing orgs use Vortex discounts).
4. Proof `prove:seal-coupons-vortex`: apply a real Vortex coupon at Vortex checkout → assert the discount is reflected (discounted amount/applied-coupon) + invalid code fails closed + boundary + existing retired provider path unaffected.

## Gates
Seal ROOT typecheck/lint/build/test; live proof vs Vortex dev; boundary; Codex reviews plan + diff.

---
## REVISED per Codex plan-review (2026-07-03) — MONEY-PATH SAFE
CQ1: Vortex checkout has NO inline coupon field. Apply coupon to CUSTOMER + billingAccountId BEFORE checkout (checkout creates subscription + finalizes first invoice, which consumes ACTIVE applied coupons for that customer/account). Do NOT apply with subscriptionExternalId pre-checkout (subscription not created yet → Vortex rejects). Wiring point: vortex_billing_processor.ts:64-75, before createCheckoutSession.
CQ2: No promo-code resource; coupon has `code`. Resolve entered code → couponId via GET /v1/coupons?status=active + exact code match. Apply by couponId (URL). Do NOT use Seal's retired provider promo tables.
CQ3: No validate endpoint. GET /v1/coupons?status=active → exact-match code → validate locally: status active, expiresAt not passed, targets.priceIds includes the checkout priceId, discount type/amount. (No maxRedemptions/timesRedeemed in Vortex contract.)
CQ4: ON-DEMAND resolve at checkout. NO local Vortex coupon sync.
CQ5 FAIL-CLOSED (the money-path safety):
- No code → checkout unchanged.
- Code present but no active match / expired / target-priceId mismatch → THROW, return NO checkout URL.
- Apply with deterministic appliedCouponId + customerExternalId + billingAccountId (NOT subscriptionExternalId).
- Parse FULL checkout response (amountTotal, amountRemaining, invoiceNumbers) — not just checkoutUrl.
- Verify discount reflected (amountTotal reduced / invoice discountTotal > 0) BEFORE returning URL.
- If apply succeeded but checkout fails OR amount mismatch → TERMINATE the applied coupon (public applied-coupon terminate route) as cleanup, then throw. Never leave a dangling active coupon (would discount a later invoice).
CQ6: Seal → requestVortexBillingJson (bearer + x-vortex-service:billing) to public coupon API only. No Finix. retired provider coupon/promo path untouched (Seal branches before retired provider checkout in subscription_actions.ts:107-152).

BUILD:
1. vortex_billing_processor.ts: add optional `promoCode` arg to the Vortex SaaS checkout path. Before createCheckoutSession (line ~64-75): if promoCode present → (a) resolveActiveVortexCoupon(promoCode, priceId) via GET /v1/coupons?status=active + exact code match + local validation (active/not-expired/target priceId) → throw if invalid; (b) applyVortexCoupon(couponId, {appliedCouponId: deterministic, customerExternalId, billingAccountId}); track the appliedCouponId.
2. Create checkout; parse FULL response (amountTotal/amountRemaining/invoiceNumbers); verify discount reflected. On checkout failure OR no discount reflected → terminateVortexAppliedCoupon(appliedCouponId) + throw (fail closed).
3. Provider-aware: only Vortex-billing SaaS checkout path; retired provider coupon path untouched.
4. Proof `prove:seal-coupons-vortex`: (a) real Vortex coupon applied at Vortex checkout → assert amountTotal reduced by the coupon; (b) invalid/expired code → throws, no checkout, no dangling applied coupon; (c) boundary Vortex-public-API-only; (d) no-code path unchanged.
