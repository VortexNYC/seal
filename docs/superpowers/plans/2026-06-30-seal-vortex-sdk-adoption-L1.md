# Seal SaaS Checkout → `@vortexnyc/payments-sdk` (#13 L1) Implementation Plan — v3

> **v3 changelog (Codex round-2 NOT-SOUND, 1 new P0 + 1 note; all 6 round-1 findings confirmed closed):** the injectable seam is now `fetchImpl?: typeof fetch` — NOT the client. The function ALWAYS builds the client with env-derived `authorization`/`x-vortex-service` headers, so the test exercises (and proves) the real production-header construction instead of bypassing it. Targeted test command corrected to `bun --cwd apps/backend run test ...` (root `bun run test <file>` routes through turbo).
> **v2 changelog (Codex round-1 NOT-SOUND, 6 findings):** seam typed as `ReturnType<typeof createClient>` (no `Client` root export — P0#1); response read is `readCheckoutUrl(data)` and `readCheckoutUrl` is UNCHANGED since the SDK `data` IS the envelope (P0#2); test mock `fetch` receives a `Request` object — assert `input instanceof Request` + `input.url`/`input.method`/`input.headers.get()`/`await input.clone().text()` (P0#3); error guard is `error !== undefined || response === undefined || !response.ok` (P1#4); set `parseAs: "json"` to match the bespoke always-JSON parse (P1#5); assert headers via `headers.get()` case-insensitively (P2#6). Confirmed by Codex: custom default headers + `fetch` override ARE supported, no Convex `"use node"` blocker, optional 3rd param does NOT break `subscription_actions.ts`.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
> **Execution model:** Claude PLANS + REVIEWS + GATES. **Codex EXECUTES** (`codex exec --full-auto "<inline spec>" < /dev/null`; Codex sandbox CANNOT write `.git` → Claude owns all commits). Codex reviews every diff.
> **Repo:** Seal at `/Users/shlomokabareti/projects/Seal`. **Base branch: `staging`.** Branch `feat/seal-vortex-sdk-adoption-l1` from staging.

**Goal:** Replace Seal's hand-rolled `fetch` transport for the Vortex SaaS subscription-checkout call with the generated, typed `@vortexnyc/payments-sdk` — **behavior-preserving** (same request payload, headers, URL, error semantics, returned checkout URL). This establishes the SDK-client pattern that L2–L3 extend; it does NOT add new lifecycle behavior.

**Architecture:** Today `apps/backend/convex/payments/vortex_billing_processor.ts` (`"use node"`) builds the checkout POST by hand (`requestVortexBillingJson`, a `fetch` seam) and parses the response (`readCheckoutUrl`). L1 swaps the transport: build an SDK client (`createClient({ baseUrl, headers })`) and call `createCheckoutSession({ client, body, headers })`. The pure parts — `selectSaasBillingProvider` (allowlist) and `resolveVortexBillingConfig` (env/config) — are UNTOUCHED. The response stays parsed via `readCheckoutUrl` because the SDK's `ApiWriteEnvelope.data` is generic (`{ [key: string]: unknown }`). The test seam moves from an injected `fetcher` to an injected SDK `client` built with a mock `fetch`.

**Tech Stack:** Bun, Convex (Node action runtime), `@vortexnyc/payments-sdk@^0.1.0` (GitHub Packages, already-authenticated `@vortexnyc` scope), Vitest.

## Global Constraints

- **Behavior-preserving.** The migrated `createVortexBillingCheckoutSession(args, env?)` MUST send: `POST {apiBaseUrl}/v1/checkout/sessions`, headers `authorization: Bearer {apiKey}`, `x-vortex-service: billing`, `Idempotency-Key: seal-saas-checkout:{org}:{normalizedLookupKey}` (exact same string as today, `vortex_billing_processor.ts:60`), and the SAME body (`mode:"subscription"`, `customerExternalId`, `billingAccountId`, `subscriptionExternalId`, `collectionMode:"automatic"`, `lineItems:[{priceId,quantity}]`, `createdByRef:"seal-saas-billing-settings"`, `metadata:{sourceSystem,sealOrganizationId,lookupKey}`). Returns the same `checkoutUrl` string. Same `ConvexError` on non-2xx.
- **Do NOT change** `selectSaasBillingProvider`, `resolveVortexBillingConfig`, the allowlist logic, or the consumer `apps/backend/convex/payments/subscription_actions.ts` (the public signature stays compatible). The `VORTEX_BILLING_*` env contract is unchanged.
- **No new endpoints.** Only the existing checkout call migrates. Customer/price/lifecycle/portal = L2/L3, out of scope.
- SDK import is from the package ROOT barrel: `import { createClient, createCheckoutSession } from "@vortexnyc/payments-sdk"` (both are root exports as of L0).
- No `any`, no `eslint-disable`, no `// @ts-ignore`. `bun`/`bunx` only.
- Gate from Seal ROOT before each commit: `bun run typecheck`, `bun run lint`, `bun run build` (if present), `bun run test` (at least the payments test). All green.
- Provider-boundary law intact: Seal (consumer) → Vortex server over HTTP only. See [[provider-boundary-law]].

---

## File Structure

- `apps/backend/package.json` — **modify**: add `@vortexnyc/payments-sdk` dependency (pin `^0.1.0`).
- `apps/backend/convex/payments/vortex_billing_processor.ts` — **modify**: swap transport in `createVortexBillingCheckoutSession`; replace the `Fetcher`/`requestVortexBillingJson` seam with an injectable SDK `client`; keep `readCheckoutUrl`, `resolveVortexBillingConfig`, `selectSaasBillingProvider`, and all parse/env helpers. Remove `requestVortexBillingJson` + `Fetcher` once unused (delete dead code).
- `apps/backend/convex/payments/vortex_billing_processor.test.ts` — **modify**: build the SDK client with a mock `fetch` and inject it; assert the request URL/method/headers/body and the parsed `checkoutUrl` exactly as today.

---

## Task 1: Add the SDK dependency (Seal can install + resolve it)

**Files:**

- Modify: `apps/backend/package.json`

**Interfaces:**

- Produces: `@vortexnyc/payments-sdk@^0.1.0` resolvable in `apps/backend`, importable in a `"use node"` Convex action.

- [ ] **Step 1: Confirm auth + resolve.** From Seal root: `cd apps/backend && bun add @vortexnyc/payments-sdk@^0.1.0`. This uses Seal's existing `@vortexnyc:registry`/`NODE_AUTH_TOKEN` contract (same one that installs `@vortexnyc/auth`). If it 401s, the deploy/CI `NODE_AUTH_TOKEN` env isn't present in this shell — STOP and report (do not hand-edit the lockfile).
- [ ] **Step 2: Verify import resolves.** Write a throwaway `apps/backend/convex/_sdkResolveSmoke.ts` with `import { createClient, createCheckoutSession } from "@vortexnyc/payments-sdk"; void createClient; void createCheckoutSession;`. Run `bun run typecheck` from Seal root → 0 errors. Then delete the smoke file.
- [ ] **Step 3: Gate + commit.** Seal root: `bun run typecheck` (+ `bun run lint`). Claude commits: `git add apps/backend/package.json bun.lock && git commit -m "build(backend): add @vortexnyc/payments-sdk for Vortex billing transport"`.

---

## Task 2: Migrate checkout transport to the SDK (behavior-preserving, TDD)

**Files:**

- Modify: `apps/backend/convex/payments/vortex_billing_processor.ts`
- Modify: `apps/backend/convex/payments/vortex_billing_processor.test.ts`

**Interfaces:**

- Consumes: `createClient`, `createCheckoutSession` from `@vortexnyc/payments-sdk`; `CreateCheckoutSessionRequest` body fields (`mode`, `customerExternalId`, `billingAccountId`, `subscriptionExternalId`, `collectionMode`, `lineItems`, `createdByRef`, `metadata`) — all confirmed present in the SDK types.
- Produces: `createVortexBillingCheckoutSession(args, env?, fetchImpl?)` where `fetchImpl?: typeof fetch` is the new injectable seam — the function ALWAYS builds the SDK client (env-derived auth + `x-vortex-service` headers) and only the `fetch` is overridable, so the test proves the real production headers. Same return `Promise<string>` (checkoutUrl). `readCheckoutUrl` unchanged (parses `data.data.checkoutSession.checkoutUrl` from the returned `ApiWriteEnvelope`).

- [ ] **Step 1: Read the SDK client config shape.** Inspect `@vortexnyc/payments-sdk` exported `Config`/`CreateClientConfig` (re-exported from the root barrel at L0) to confirm how to set `baseUrl`, default `headers` (need custom `x-vortex-service` + `authorization: Bearer`), and a `fetch` override (for tests). Confirm `createCheckoutSession` returns `{ data, error, response }` when `throwOnError` is unset.
- [ ] **Step 2: Update the test to the client seam (write it first — it should fail to compile).** In `vortex_billing_processor.test.ts`, replace the mock `fetcher` (`:70-93`) with a mock `fetch` passed into a real SDK client. **CRITICAL (Codex P0#3): `@hey-api` calls `fetch(request)` with a constructed `Request` object — NOT `fetch(url, init)`.** Capture and assert off the `Request`:

```ts
import { createVortexBillingCheckoutSession } from "./vortex_billing_processor";

let captured: Request | undefined;
const mockFetch: typeof fetch = async (input) => {
  // hey-api always passes a Request here
  captured = input instanceof Request ? input : new Request(String(input));
  return new Response(
    JSON.stringify({
      data: { checkoutSession: { checkoutUrl: "https://pay.vortex.test/abc" } },
      requestId: "req_1",
    }),
    { status: 201, headers: { "content-type": "application/json" } }
  );
};
// Inject the FETCH (3rd arg) — the function builds the client with env-derived headers,
// so this test proves Seal constructs the real production headers.
const checkoutUrl = await createVortexBillingCheckoutSession(
  { organizationId: "org_1", lookupKey: "pro_monthly", quantity: 1 },
  {
    /* same VORTEX_BILLING_* env stub as the existing test (apiBaseUrl=https://billing.vortex.test, apiKey=..., price/account/customer maps) */
  },
  mockFetch
);
expect(checkoutUrl).toBe("https://pay.vortex.test/abc");
expect(captured).toBeInstanceOf(Request);
expect(captured?.url).toBe("https://billing.vortex.test/v1/checkout/sessions");
expect(captured?.method).toBe("POST");
expect(captured?.headers.get("authorization")).toBe(
  "Bearer <apiKey-from-env-stub>"
);
expect(captured?.headers.get("x-vortex-service")).toBe("billing");
expect(captured?.headers.get("idempotency-key")).toBe(
  "seal-saas-checkout:org_1:pro_monthly"
);
const sentBody = JSON.parse(await captured!.clone().text());
expect(sentBody).toEqual({
  /* same payload asserted today: mode/customerExternalId/billingAccountId/subscriptionExternalId/collectionMode/lineItems/createdByRef/metadata */
});
```

The env stub's `apiBaseUrl` MUST be `https://billing.vortex.test` so the asserted URL matches. Use `headers.get()` (case-insensitive, Codex P2#6) — never index raw header objects. Also keep one non-2xx test: mock `fetch` returns `status: 422` (JSON error body) → expect the same `ConvexError` shape Seal throws today.

- [ ] **Step 3: Run the test → confirm it FAILS** (the `fetchImpl` arg + the new import don't exist yet). **Targeted command (root `bun run test <file>` routes through turbo — Codex r2 note):** `cd /Users/shlomokabareti/projects/Seal && bun --cwd apps/backend run test convex/payments/vortex_billing_processor.test.ts` → FAIL.
- [ ] **Step 4: Implement the transport swap.** In `vortex_billing_processor.ts`:
  - Add imports: `import { createClient, createCheckoutSession } from "@vortexnyc/payments-sdk";` (NO `Client` import — it is not a root export, Codex P0#1).
  - **The injectable seam is `fetch`, NOT the client (Codex r2 P0).** The function ALWAYS builds the client with env-derived headers, so the test exercises the REAL production-header construction. Signature: `export async function createVortexBillingCheckoutSession(args: VortexBillingCheckoutArgs, env: Env = process.env, fetchImpl?: typeof fetch): Promise<string>`.
  - Build the client from config (always — auth/service headers are part of the function's behavior under test), with an optional `fetch` override, and call with `parseAs: "json"` (Codex P1#5 — the bespoke always parses JSON; default `"auto"` would drift on a missing/odd Content-Type):

```ts
const config = resolveVortexBillingConfig(args, env);
const billingClient = createClient({
  baseUrl: trimTrailingSlash(config.apiBaseUrl),
  headers: {
    authorization: `Bearer ${config.apiKey}`,
    "x-vortex-service": "billing",
  },
  ...(fetchImpl ? { fetch: fetchImpl } : {}),
});
const idempotencyKey = `seal-saas-checkout:${args.organizationId}:${normalizeExternalIdPart(args.lookupKey)}`;
const { data, error, response } = await createCheckoutSession({
  client: billingClient,
  parseAs: "json",
  headers: { "Idempotency-Key": idempotencyKey },
  body: {
    mode: "subscription",
    customerExternalId: config.customerExternalId,
    billingAccountId: config.billingAccountId,
    subscriptionExternalId: config.subscriptionExternalId,
    collectionMode: "automatic",
    lineItems: [{ priceId: config.priceId, quantity: args.quantity }],
    createdByRef: "seal-saas-billing-settings",
    metadata: {
      sourceSystem: "seal",
      sealOrganizationId: args.organizationId,
      lookupKey: args.lookupKey,
    },
  },
});
// Codex P1#4: response can be undefined on network/build/parse failure — guard it before .ok / .status.
if (error !== undefined || response === undefined || !response.ok) {
  const status = response?.status ?? "no-response";
  throw new ConvexError(
    `Vortex Billing checkout failed (${status}): ${summarizeJson(error ?? data)}`
  );
}
return readCheckoutUrl(data);
```

- **`readCheckoutUrl` is UNCHANGED** (Codex P0#2): the SDK's returned `data` IS the parsed `ApiWriteEnvelope` (`{ data: { checkoutSession: { checkoutUrl } }, requestId }`), identical to today's response body — so `readCheckoutUrl(data)` reads `data.data.checkoutSession.checkoutUrl` exactly as before. Do NOT wrap as `{ data }` (would double-nest), and do NOT change the parser's guards/`ConvexError("...did not include checkoutUrl")`.
- Delete `requestVortexBillingJson` and the `Fetcher` type once unused. Keep `summarizeJson`, `readObject`, `parseJson`, env/config helpers.
- [ ] **Step 5: Run the test → PASS.** `bun --cwd apps/backend run test convex/payments/vortex_billing_processor.test.ts` → PASS. Confirm the asserted URL/method/headers/body and returned `checkoutUrl` all match.
- [ ] **Step 6: Full gate.** Seal root: `bun run typecheck && bun run lint && bun run test` (the full-suite root commands; turbo fans out to workspaces). (Run `bun run build` if Seal defines it.) All green. Grep to confirm no remaining `fetch(` transport in this file and no dead `Fetcher`/`requestVortexBillingJson`.
- [ ] **Step 7: Commit.** Claude: `git add apps/backend/convex/payments/vortex_billing_processor.ts apps/backend/convex/payments/vortex_billing_processor.test.ts && git commit -m "refactor(billing): route Vortex SaaS checkout through @vortexnyc/payments-sdk (transport swap, behavior-preserving)"`.

---

## Task 3: Reviewer + push

- [ ] **Step 1: Codex diff review.** `codex exec --full-auto "Review this diff for behavior drift vs the bespoke fetch: same URL/method/headers (Bearer + x-vortex-service + exact Idempotency-Key)/body/error-semantics/returned checkoutUrl? Any field the SDK drops or renames? <inline git diff>" < /dev/null`. Address findings.
- [ ] **Step 2: Push + PR** (REQUIRES Shlomo's ok — git remote gate). `git push -u origin feat/seal-vortex-sdk-adoption-l1`; open PR to `staging`. Watch Seal CI green.
- [ ] **Step 3: Resume pointer.** Update the vortex-payments memory [[vortexnyc-payments-sdk-l0-published]] → "L1 DONE (SaaS checkout on SDK); NEXT = L2 (customer provisioning + price source → Vortex via SDK upsertCustomer/createPrice)."

---

## Self-Review

**Spec coverage:** dep add (T1) ✓ · transport swap preserving URL/headers/body/error/return (T2, Global Constraints) ✓ · test migrated to client seam (T2) ✓ · pure allowlist/config untouched (Global Constraints) ✓ · reviewer + push (T3) ✓.

**Placeholder scan:** No TBD. Body fields, headers, idempotency-key string, and response path are all spelled out with the exact values from `vortex_billing_processor.ts`.

**Type consistency:** `createVortexBillingCheckoutSession` gains a 3rd `fetchImpl?: typeof fetch` param in both the impl (T2 Step 4) and the test (T2 Step 2) — the function always builds the client with env-derived headers; only `fetch` is injectable. `createClient`/`createCheckoutSession` are root barrel exports (L0); `Client` is NOT a root export (unused — no client type needed now). Request body fields match `CreateCheckoutSessionRequest`; `readCheckoutUrl(data)` is UNCHANGED (SDK `data` === old envelope body).

**Resolved by Codex round 1 (now baked into the plan):** `Client` not a root export → `ReturnType<typeof createClient>` (P0#1); `readCheckoutUrl(data)` not `{ data }` (P0#2); mock `fetch` receives a `Request`, assert via `instanceof`/`.url`/`.headers.get()`/`.clone().text()` (P0#3); guard `response === undefined` (P1#4); `parseAs: "json"` (P1#5); case-insensitive header asserts (P2#6). Confirmed: custom headers + `fetch` override supported; no Convex `"use node"` blocker (SDK is ESM/Fetch, Seal is ESM/bundler); optional 3rd param is arity-safe for `subscription_actions.ts`.

**Residual risks for Codex round 2:** (a) the exact option key for `parseAs` (operation-level vs client-level) — confirm against the installed SDK in T2 Step 1. (b) whether `createCheckoutSession`'s success `data` is typed loosely enough that `readCheckoutUrl(data)` typechecks without a cast (it consumes `unknown` internally, so it should). (c) any Seal lint rule (e.g. import ordering, no-floating-promises) the new code must satisfy.
