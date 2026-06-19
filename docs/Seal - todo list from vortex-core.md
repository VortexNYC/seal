# Seal - Vortex Core cleanup todo

Last checked: 2026-06-19.

Purpose: keep Seal as the high-pressure Vortex Core consumer without turning the repo into a local fork of Core auth/tooling. Seal owns document workflow, recipient access, billing/payment adoption, API/MCP product behavior, and RLS. Core owns shared auth/tooling primitives.

## Current state

- Branch: `staging`, upstream `origin/staging`, ahead by 6 after `d70f2362 Migrate contact email lookup to RLS wrapper`.
- Working tree was clean after the cleanup pass.
- Package baseline is current for the Core audit: root `@plasmapos/auth@0.5.1`, root `@plasmapos/tooling@0.2.13`, backend `@convex-dev/better-auth@0.12.2`, backend `better-auth@1.6.9`, backend `convex-helpers@^0.1.114`, catalog `convex@^1.41.0`.
- Seal does not currently need the `@plasmapos/vortex-core` umbrella package just to satisfy standards. Direct `@plasmapos/auth` plus `@plasmapos/tooling` is enough until another Core surface is adopted.
- Root scripts already point at Core-owned binaries: `repo:status`, `repo:check`, `check:preferred-stack`, `auth:check`, `auth:preflight`, `project-kit:check`, `lint`, `format`, `lint:strict`, and `lint:advisory`.
- `bun install --frozen-lockfile` is required on a fresh checkout before those binaries exist in `node_modules/.bin`.
- `bun run repo:status` passes after install.
- `bun run migrate:legacy-auth-package:check` passes after install.
- Full local proof passed in the cleanup pass: install, repo status, migration check, format changed check, lint, typecheck, auth check, auth preflight, preferred stack, project-kit check, knip, test, and build.
- Active app/package/script/.test-env scan for `@clerk`, `Clerk`, `clerk`, and `CLERK_` returns zero matches outside generated/test output. Remaining Clerk text is docs/history and cosmetic field names.
- The migration runbook is now marked historical evidence, not active operator guidance.
- Third standards run migrated `contacts.queries.getByEmail` from legacy `../auth` `permissionQuery` to RLS-backed `../auth/wrappers` `permissionQuery`.

## Do now

1. Keep Seal proofable from the root.
   - Run `bun install --frozen-lockfile` if `node_modules/.bin/vortex-repo-check` is missing.
   - Start serious work with `bun run repo:status`.
   - End serious work with the strongest subset of: `bun run lint`, `bun run format:changed:check`, `bun run typecheck`, `bun run knip`, `bun run auth:check`, `bun run auth:preflight`, `bun run check:preferred-stack`, `bun run test`, `bun run build`.

2. Finish stale-instruction cleanup.
   - Replace active `npx convex ...` instructions with `bunx convex ...`.
   - Leave generated Convex `npx convex dev` comments alone unless regenerating generated files.
   - Leave historical exploration logs alone unless they are promoted to active guidance.

3. Ratchet local auth wrappers only with proof.
   - Inventory `apps/backend/convex/auth.ts`, `apps/backend/convex/auth/wrappers.ts`, and `apps/backend/convex/auth/recipient_wrappers.ts`.
   - Classify each wrapper as `core-builder`, `core-builder-plus-rls`, `local-admin-policy`, `local-member-policy`, `recipient-token-policy`, or `delete`.
   - Preserve `wrapDatabaseReader`, `wrapDatabaseWriter`, and `rlsRules` unless Core has a proven replacement with identical RLS behavior.
   - Migrate one low-risk `permissionQuery` and one low-risk `permissionMutation` first. Prove denied-before-handler, cross-org denial, RLS-scoped reads/writes, audit/log behavior, and clean generated Convex types before any sweep.

4. Keep API/MCP scope safety explicit.
   - API keys and MCP OAuth must use package/component helpers for parsing, verification, org scoping, revocation, expiry, IP allowlist, and audit behavior.
   - Owner/admin role is not enough for API or MCP access. Token scope remains a ceiling on top of live role permissions.
   - New API/MCP endpoints need negative proof for missing token, malformed token, wrong audience, expired token, revoked credential, cross-org request, insufficient token scope, suspended principal, and disabled service principal where applicable.

5. Keep billing/payment migration separate.
   - Auth cleanup PRs should not change billing, payment, Stripe, RLS, or document access behavior unless a single proof path requires it.
   - Billing/payment proof commands stay targeted: `prove:vortex-billing-settings-adoption`, `prove:vortex-payments-settings-adoption`, `prove:vortex-merchant-settings-adoption`, `prove:vortex-operational-payments-adoption`, and `prove:vortex-payments-backend-adapter-adoption`.

## Next run target

- Do not redo package/tooling alignment; it is already current.
- Finish active stale-instruction cleanup only where docs are current operator guidance.
- Audit `apps/backend/convex/auth.ts`, `apps/backend/convex/auth/wrappers.ts`, and `apps/backend/convex/auth/recipient_wrappers.ts`; classify what is Seal-specific RLS/recipient policy versus generic Core authz.
- Continue one low-risk wrapper migration at a time only if proof can show identical RLS, recipient, denial, and audit behavior.

## Third standards run assignment - 2026-06-19

Worker scope: move one low-risk protected function from the legacy raw `apps/backend/convex/auth.ts` wrapper path to the RLS-backed `apps/backend/convex/auth/wrappers.ts` path, or prove that no safe first candidate exists yet.

- Start by finding one simple `permissionQuery` or `permissionMutation` call site with existing auth/denial coverage and no recipient-token behavior.
- Preserve `wrapDatabaseReader`, `wrapDatabaseWriter`, `rlsRules`, denied-before-handler behavior, cross-org denial, audit/log behavior, and generated Convex types.
- Do not touch recipient-token wrappers in this run.
- Do not sweep all imports. One proved migration is the target.
- If no low-risk call site has enough coverage, add the missing targeted denial/RLS proof first and document the blocker.

Result: `contacts.queries.getByEmail` was the first proved candidate. Added targeted coverage for unauthenticated denial before lookup, cross-org non-leakage, authenticated-org row selection under duplicate email, and audit-log count unchanged by the migrated read query.

## Wrapper audit - 2026-06-19

The first wrapper migration has landed. Existing proof now covers one read-only candidate, but it does not justify broad import sweeps. Future migrations still need denied-before-handler behavior, cross-org denial, RLS-scoped reads/writes, audit behavior, and recipient-token access proof where applicable.

| Path                                             | Surface                                                                | Classification                                                                | Action                                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/convex/auth.ts`                    | `getAuthContext` and its component-membership helpers                  | `core-builder` candidate with Seal-local subscription and role utility policy | Keep until Core exposes an equivalent active-org/component-membership builder and Seal can keep its subscription/userType fields without behavior drift. |
| `apps/backend/convex/auth.ts`                    | `authQuery`, `authMutation`, `permissionQuery`, `permissionMutation`   | `local-member-policy`; future delete after migration                          | These are still widely imported and do not wrap `ctx.db` with RLS. Migrate call sites to RLS wrappers only with targeted proof.                          |
| `apps/backend/convex/auth.ts`                    | `adminQuery`, `adminMutation`, `memberQuery`, `memberMutation`         | `local-admin-policy` / `local-member-policy`                                  | Keep local for now; these enforce Seal role semantics and expose raw `ctx.db`.                                                                           |
| `apps/backend/convex/auth/wrappers.ts`           | `authQuery`, `permission*Query`, `authMutation`, `permission*Mutation` | `core-builder-plus-RLS`                                                       | Best migration target: it delegates auth to component permissions and wraps reads/writes with `rlsRules`.                                                |
| `apps/backend/convex/auth/wrappers.ts`           | `adminQuery`, `ownerQuery`, `adminMutation`, `ownerMutation`           | `core-builder-plus-RLS` with local admin/owner policy                         | Keep as Seal-specific role policy unless Core gains a role-threshold wrapper factory that accepts local role semantics.                                  |
| `apps/backend/convex/auth/recipient_wrappers.ts` | `recipientQuery`, `recipientMutation`, `validateRecipientToken`        | `recipient-token-policy`                                                      | Keep local. RLS is intentionally not applied; signing-token validation is the access boundary.                                                           |

## Known cleanup debt

- `docs/vortex-auth-migration.md` is historical and should be marked or moved when there is a small docs-only pass. It still contains accurate migration evidence plus stale phase text.
- Several non-archive planning docs still mention Clerk as old context. They are not live app dependencies, but they can mislead agents if treated as current plans.
- Lint bypasses remain in four hand-written files. Do not delete blindly: current cases cover a synthetic Stripe payload, an intentional E2E polling loop, and two intentional React effect reset dependencies.
- `users.clerkId`, `organizations.clerkId`, and similar names are post-migration auth-subject compatibility names. Rename only as a planned data/code migration, not as cleanup theater.

## Stop conditions

Stop and fix before continuing if:

- a protected Convex query/mutation bypasses wrappers
- a Core auth builder adoption drops Seal RLS behavior
- a user can see or mutate another organization's documents
- owner/admin role bypasses API or MCP token scope
- revoked, expired, suspended, disabled, or wrong-org principals can act
- active app/package/script/.test-env code depends on Clerk again
- a deployment proof targets the wrong Convex deployment
