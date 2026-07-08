# Kill-list #7 — Re-source Seal SaaS catalog from Vortex (not retired provider)

**Why:** Seal's SaaS catalog projection (`subscription_products`/`subscription_prices`) is currently synced from retired provider (`retired_provider/sync.ts` `syncFromretired providerInternal`: `products.list`/`prices.list`; `sync_helpers.ts`). Seal's SaaS subscriptions already run through Vortex billing (cutover built), so Vortex billing is the real catalog source of truth. Re-source the projection from Vortex `catalogList` so the catalog stops depending on retired provider. Boundary: Seal → Vortex public API only.

## Grounding
- Seal sync: `retired_provider/sync.ts:187 syncFromretired providerInternal` pages `retired_provider.products.list` (209) + `sync_helpers.ts:155 retired_provider.prices.list` → `upsertProduct`/`upsertPrice` into `subscription_products`/`subscription_prices`. Triggered by `syncFromretired providerWebhook` (253) + manual.
- Vortex: `catalogHttp.list` → GET `apiRoutes.catalogList` (http.ts:1076) → `billingEngine.listCatalog` → `{ products, prices }`. Products/prices list + by-id handlers exist.
- Seal already calls Vortex billing via `requestVortexBillingJson` (used across vortex_billing/*).

## Scope (Seal-side; Vortex catalog already exposed)
1. New Seal internal action `syncCatalogFromVortex` (mirror syncFromretired providerInternal shape): GET Vortex catalog via `requestVortexBillingJson` → map Vortex products/prices → existing `upsertProduct`/`upsertPrice` (keep the tables + external-id keying; store Vortex product/price ids as the external id, or add a `vortexProductId`/`vortexPriceId` field — decide via Codex CQ). Keep `setProductStatus`/`setPriceStatus` for archived/inactive.
2. Provider-aware trigger: for allowlisted/Vortex billing orgs, catalog syncs from Vortex; retired provider path unchanged for others (or global if catalog is org-agnostic — Codex CQ). Do NOT delete `syncFromretired provider` yet (1d-style cleanup later).
3. Idempotent + safe: re-running produces no dupes (external-id upsert); archived Vortex items → inactive in Seal.
4. Proof: `prove:seal-catalog-from-vortex` — seed/confirm Vortex has a catalog → run `syncCatalogFromVortex` → assert `subscription_products`/`subscription_prices` reflect Vortex's catalog (ids, amounts, intervals) + no retired provider calls. Boundary: Vortex public API only.

## Central questions for Codex
- CQ1: Exact Vortex `catalogList` response shape (product + price fields: id, name, amount, currency, interval, active, productId linkage) from catalogHttp/billingEngine.listCatalog + the contract — so the Seal mapping is precise.
- CQ2: Keying — do `subscription_products`/`subscription_prices` key on a retired provider external id today? To re-source from Vortex, use Vortex ids as the external id, or add `vortexProductId`/`vortexPriceId` columns? Which avoids breaking existing subscription references to prices?
- CQ3: Is the catalog global or per-org/per-merchant in Vortex? How does listCatalog scope (tenant via API key)? Does Seal need one sync or per-org?
- CQ4: Trigger — replace the webhook-driven retired provider sync with a Vortex-sourced sync (scheduled/manual/on-demand). Any Vortex catalog webhook, or poll/manual?
- CQ5: Boundary — confirm Seal reads only Vortex public catalog API (no Finix, no direct billing-engine).

## Gates
Seal ROOT typecheck/lint/build/test; live proof vs Vortex dev; boundary; Codex reviews plan + diff.

---
## REVISED per Codex plan-review (2026-07-03; verdict REVISE) — SAFETY-LOCKED
CQ1 shape: GET /v1/catalog → `{ data: { products[], prices[] }, requestId }`. Product: `productId,name,active,metadata,createdAt,archivedAt`. Price: `priceId,productId,priceType,currency,billingInterval,unitAmount,...,archivedAt`. Use productId/priceId (NOT id), unitAmount (NOT amount), price active = `archivedAt===undefined`. Currency UPPERCASE USD/CAD (retired provider rows lowercase → normalize deliberately).
CQ2 KEYING (critical): Seal keys `subscription_products.externalProductId` / `subscription_prices.externalPriceId` (retired provider ids). LIVE subs resolve entitlements by `subscriptions.externalPriceId → subscription_prices.externalPriceId` (auth/subscription_guards.ts, payments/billing_queries.ts, vortex_billing/projection.ts). **DO NOT mutate existing retired provider externalIds.** ADD `vortexProductId`/`vortexPriceId` columns + indexes + a provider-aware resolver; Vortex-sourced rows carry Vortex ids; only set `externalPriceId=vortexPriceId` for rows with NO retired provider legacy + all readers resolver-backed.
CQ3 scope: catalog is TENANT/API-KEY scoped (org+environment). ONE sync per configured Vortex billing API key/env — NOT per Seal org. (Caveat: Vortex products.list filters org-only not env — note it, don't depend on env filtering for products.)
CQ4 trigger: NO catalog webhook exists. Use a MANUAL internal action + a SCHEDULED sync. Add a fail-closed pre-check before Vortex checkout / webhook projection so a missing catalog row surfaces BEFORE a paid user hits entitlement breakage.
CQ5 boundary: Seal → `requestVortexBillingJson({ method:"GET", path:"/v1/catalog" })` only. No Finix, no direct billingEngine.

BUILD (Seal-side, ADDITIVE, no in-place mutation of retired provider rows):
1. Schema: add optional `vortexProductId` on subscription_products + `vortexPriceId` on subscription_prices (+ `by_vortex_product_id`/`by_vortex_price_id` indexes). Keep retired provider external-id columns/indexes untouched.
2. `syncCatalogFromVortex` internal action: GET /v1/catalog → map products/prices → upsert BY VORTEX ID (new upsert path keyed on vortexProductId/vortexPriceId), set inactive when archivedAt present, normalize currency to lowercase to match existing rows. Never touches retired provider-keyed rows.
3. Provider-aware price resolver used by subscription_guards + billing_queries + vortex projection: resolve a subscription's price by externalPriceId OR vortexPriceId (so both legacy retired provider subs AND Vortex subs resolve). Additive — legacy path unchanged.
4. Fail-closed pre-check before Vortex checkout/projection: if the referenced Vortex price row is missing, surface a clear error (don't silently drop to free).
5. Scheduled sync (cron) + manual internal action. Keep retired provider sync intact (1d cleanup later).
6. Proof `prove:seal-catalog-from-vortex`: (a) run syncCatalogFromVortex vs Vortex dev → assert subscription_prices has Vortex rows (priceId, unitAmount, interval) ; (b) CRITICAL: assert an existing retired provider-shaped subscription STILL resolves its entitlement after the sync (no paid→free regression); (c) boundary Vortex-public-API-only.
