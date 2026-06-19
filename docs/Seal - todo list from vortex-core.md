# Seal - todo list from vortex-core

Purpose: make Seal a dependable second serious consumer of Vortex Core standards. Seal is the stress test because it has real org/RBAC, documents, API, MCP, webhooks, billing, and public product surfaces. If Core auth and tooling work here, the pattern is worth copying.

Status snapshot:

- Repo state checked from `staging`.
- Local tree was clean against `origin/staging` when this file was written.
- Seal already uses `@plasmapos/auth@0.5.1`.
- Seal root scripts already include Vortex tooling checks: `auth:check`, `auth:preflight`, `repo:status`, `repo:check`, `project-kit:check`, `check:preferred-stack`, `lint:strict`, and `lint:advisory`.
- Seal backend already has `convex-helpers`.
- Seal still owns substantial local auth wrapper code in `apps/backend/convex/auth.ts` and `apps/backend/convex/auth/wrappers.ts`.
- Seal uses `staging` as its base branch. Do not branch from or PR to `main`.

## P0 - prove Seal against package-owned auth wrappers

Why this is first:

- Vortex Core already ships package-owned auth function builders.
- CRM already proves the package builders.
- Seal is the stronger second proof because it has real document, org, API, MCP, webhook, billing, and role pressure.
- Seal local wrappers are a drift risk if they keep reimplementing package authz decisions.

Todo:

- [ ] Inventory every Seal auth wrapper exported from `apps/backend/convex/auth.ts` and `apps/backend/convex/auth/wrappers.ts`.
- [ ] Classify each wrapper as:
  - `replace-with-core-builder`
  - `compose-core-builder-plus-rls`
  - `admin-only-local-policy`
  - `member-only-local-policy`
  - `recipient-specific-policy`
  - `delete`
- [ ] Build one canonical Seal auth adapter file that creates package builders from Core glue.
- [ ] Preserve Seal RLS behavior. Do not drop `wrapDatabaseReader`, `wrapDatabaseWriter`, or `rlsRules` just to use the package builder.
- [ ] If Core's current builder cannot express "permission gate plus RLS-wrapped db" cleanly, document the exact package gap and patch Core before sweeping Seal.
- [ ] Migrate one low-risk `permissionQuery` and one low-risk `permissionMutation` to prove the shape.
- [ ] Prove:
  - permission-denied fails before handler body
  - cross-org access is denied
  - RLS still scopes reads/writes
  - audit/log behavior remains intact
  - generated Convex types remain clean
- [ ] Only after the first proof is green, sweep additional Seal call sites.

Do not do a blind find/replace. Seal's wrappers carry RLS and local domain policy. The secure path is the only acceptable path.

## P0 - remove remaining auth-provider residue from live paths

Known state:

- Seal migration docs say Clerk was functionally dethroned.
- Search still finds many Clerk mentions, mostly archived docs and historical migration notes.
- Live code must not depend on Clerk as product authority.

Todo:

- [ ] Run `bun run migrate:legacy-auth-package:check`.
- [ ] Run a live-code-only scan for Clerk imports and `CLERK_*` env usage outside archive/test-session docs.
- [ ] Confirm `apps/web`, `apps/backend`, and `apps/mcp-worker` have no active Clerk provider/runtime dependency.
- [ ] Keep historical Clerk references only under archive, migration notes, or compatibility explanations.
- [ ] If a live route, API path, or E2E helper still assumes Clerk, replace it with Better Auth / Vortex Auth equivalents.
- [ ] Update `.test-env` if it still points agents toward Clerk-era auth proof.

## P0 - keep component truth authoritative

Seal must match the Vortex Core ownership model:

- Better Auth owns credential/session mechanics.
- Vortex Auth component owns identity, org, member, role, invitation, API-key, webhook, OTP, MCP/OAuth policy.
- Seal owns document/product data, local adapter glue, document workflow policy, and app-specific API behavior.

Todo:

- [ ] No new local auth truth tables.
- [ ] No new `clerkId`, `clerkMembershipId`, or provider-owned invite fields.
- [ ] No raw writes to component-owned truth except through package/component APIs.
- [ ] Keep invitation truth on the Vortex Auth component.
- [ ] Keep API keys on the Vortex Auth component.
- [ ] Keep MCP/OAuth auth through package helpers and Seal's `/api/v1` resource server topology.
- [ ] Keep local document permissions as Seal product policy, but gate the principal/org/authz decision through Core-compatible wrappers.

## P0 - standardize API and MCP scope safety

Seal previously exposed a real drift bug class: owner privilege cannot bypass OAuth/API token scope ceilings. Do not regress it.

Todo:

- [ ] Keep API-key auth using package request parsing, token verification, org scoping, IP allowlist, revocation, expiry, and audit helpers.
- [ ] Keep MCP OAuth using package helpers.
- [ ] No API/MCP path may authorize from owner/admin role alone.
- [ ] Token scope must be an additional ceiling on top of live RBAC.
- [ ] Add or keep negative proof for:
  - missing token
  - malformed token
  - wrong audience
  - expired token
  - revoked credential
  - cross-org request
  - owner with insufficient token scope
  - suspended user/member
  - disabled service principal if applicable
- [ ] If a new MCP tool or REST endpoint is added, add scope/resource/audit proof in the same PR.

## P0 - prove package install/runtime health

Todo:

- [ ] Run `bun run auth:check` before changing auth-owned identity/org/member/role/invitation/API-key/MCP paths.
- [ ] Run `bun run auth:preflight` after dependency, env, Convex auth config, HTTP auth route, Better Auth runtime, or deployment changes.
- [ ] Keep Convex deployment targeting explicit. Do not rely on `CONVEX_DEPLOYMENT` alone when a deploy key is required.
- [ ] Keep staging proof pointed at the real staging deployment, not whichever Convex deployment happens to be default locally.

## P0 - align with Vortex Core repo/tooling standards

Todo:

- [ ] Keep root scripts backed by `@plasmapos/tooling`.
- [ ] Run `bun run project-kit:check` before shared-tooling handoff.
- [ ] Run `bun run repo:status` at the start of significant work.
- [ ] Run `bun run repo:check` before merge.
- [ ] Run `bun run check:preferred-stack` before merge when config, package, Convex, or app runtime changes.
- [ ] Do not fork Core lint/format/repo/auth tooling locally.
- [ ] Do not version-bump or release for refactors.

## P1 - clean stale docs without deleting useful history

Todo:

- [ ] Mark `docs/vortex-auth-migration.md` as completed/historical where it is no longer current.
- [ ] Move stale Clerk-era feature specs deeper under archive if they are not live planning inputs.
- [ ] Keep one short current auth-state document that names:
  - current auth package version
  - active Better Auth URL pattern
  - active Convex deployments
  - package-owned surfaces
  - local adapter boundaries
  - proof commands
- [ ] Do not let archived Clerk plans show up as active implementation guidance.

## P1 - adopt Core frontend surfaces where they remove duplication

Todo:

- [ ] Keep product-specific document/signature UI in Seal.
- [ ] Use Core auth/account/org/security/API-key/webhook components where the surface is generic.
- [ ] Do not rebuild Core auth UI locally.
- [ ] Run `bun run react:doctor` after meaningful web UI changes.
- [ ] Run `bun run react:doctor:full` before broad web cleanup.
- [ ] Use Playwright POMs and `data-testid` selectors for E2E; do not use CSS-class selectors.

## P1 - keep billing/payment adoption separate from auth adoption

Seal also consumes Vortex Billing/Payments surfaces. Do not mix those migrations with auth-wrapper adoption unless a single proof path requires both.

Todo:

- [ ] Keep auth PRs focused on auth, wrappers, runtime, proof, and docs.
- [ ] Keep billing/payment PRs focused on billing/payment surfaces.
- [ ] If one test proves both, call that out explicitly in the PR body and proof notes.

## Full proof wall

Run from repo root before merging meaningful Core-adherence work:

```bash
bun run repo:status
bun run lint
bun run format:changed:check
bun run typecheck
bun run knip
bun run auth:check
bun run auth:preflight
bun run check:preferred-stack
bun run test
bun run build
```

Add targeted proof when touched:

```bash
bun --cwd apps/backend run test
bun --cwd apps/web run test:e2e
bun run prove:vortex-billing-settings-adoption
bun run prove:vortex-payments-settings-adoption
bun run prove:vortex-merchant-settings-adoption
bun run prove:vortex-operational-payments-adoption
bun run prove:vortex-payments-backend-adapter-adoption
```

Run Convex codegen after backend schema/API changes and commit generated Convex files intentionally:

```bash
bunx convex codegen --cmd "true"
```

## Stop conditions

Stop and fix before continuing if:

- any protected Convex query/mutation bypasses wrappers
- a Core auth builder adoption drops Seal RLS behavior
- a user can see or mutate another organization's documents
- owner/admin role bypasses token scope
- revoked, expired, suspended, disabled, or wrong-org principals can act
- a Clerk live path reappears
- a package-owned auth surface requires Seal code to be copied into another app
- a deployment proof targets the wrong Convex deployment
