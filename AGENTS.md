# PROJECT KNOWLEDGE BASE

<!-- [CLEAN] VAL-T2-SEAL-1777054289449: minimal edit pipeline proof -->

**Generated:** 2026-03-10 14:37 CET
**Commit:** f7b9cd2
**Branch:** main

## OVERVIEW

Seal is a Bun + Turborepo monorepo with a React 19 product app, a TanStack Start landing/docs site, a Convex backend, an MCP server, transactional email templates, an embeddable React SDK, and shared design tokens. Auth uses Better-Auth through Vortex Auth (`@vortexnyc/auth`); the product UI uses Tailwind v4 + Shadcn patterns.

## STRUCTURE

```text
seal/
├── apps/               # web, landing, backend, mcp-server
├── packages/           # transactional, react-sdk, tokens
├── tooling/            # shared TypeScript config
├── docs/               # planning, architecture, design notes (mostly archival)
├── .mcp.json           # MCP server config
├── turbo.json          # Turborepo task graph
└── bunfig.toml
```

## WHERE TO LOOK

| Task                   | Location                                                       | Notes                                           |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Architecture overview  | `docs/archive/root/DOCUMENTATION_INDEX.md`                     | Current index lives under `archive/root`        |
| Permissions & roles    | `docs/archive/root/ROLES_AND_PERMISSIONS.md`                   | Historical reference; verify live auth code too |
| Backend auth wrappers  | `apps/backend/convex/auth.ts`                                  | Always use wrappers                             |
| Backend permissions    | `apps/backend/convex/auth.utils.ts`                            | Role hierarchy + permission helpers             |
| REST API v1            | `apps/backend/convex/api/v1/`                                  | Public API endpoints                            |
| Product web routing    | `apps/web/src/routes/`                                         | TanStack file-based routes                      |
| Product web entry      | `apps/web/src/main.tsx`                                        | Better-Auth + Convex + Router setup             |
| Landing/docs routes    | `apps/landing/src/routes/`                                     | Marketing site, docs, API reference             |
| Published docs content | `apps/landing/content/docs/`                                   | Fumadocs MDX source                             |
| API spec source        | `apps/landing/openapi.yaml`                                    | Generates API docs                              |
| MCP tools/resources    | `apps/mcp-server/src/tools/`, `apps/mcp-server/src/resources/` | MCP server surface                              |
| Email templates        | `packages/transactional/src/emails/`                           | React Email templates                           |
| React SDK              | `packages/react-sdk/src/`                                      | Embeddable signing components                   |
| Shared design tokens   | `packages/tokens/src/`                                         | Shared fonts/theme exports                      |
| E2E tests              | `apps/web/e2e/`                                                | Playwright POM pattern                          |

## SUBDIRECTORY GUIDES

- `apps/web/AGENTS.md`
- `apps/landing/AGENTS.md`
- `apps/backend/convex/AGENTS.md`
- `apps/mcp-server/AGENTS.md`
- `packages/transactional/AGENTS.md`

## CONVENTIONS (PROJECT-SPECIFIC)

- TypeScript strict: no `any`, `@ts-ignore`, `@ts-expect-error`, `as any`; exported functions have explicit return types.
- Convex backend: use auth wrappers; commit `apps/backend/convex/_generated/`.
- Routes: TanStack file-based; `apps/web/src/routeTree.gen.ts` and `apps/landing/src/routeTree.gen.ts` are generated.
- Landing docs: `apps/landing/.source/*` and `apps/landing/content/docs/api-reference/*` are generated artifacts; regenerate from source instead of hand-editing.
- E2E: Playwright page objects; prefer `data-testid` selectors.

## ANTI-PATTERNS (THIS PROJECT)

- Raw Convex `query`/`mutation` without wrappers.
- Modify `apps/backend/convex/schemas/subscription_coupons.ts` or `apps/backend/convex/schemas/subscription_promo_codes.ts` directly.
- Mutate historical usage counters directly; preserve usage history through documented payment projections.
- Edit generated files: `apps/backend/convex/_generated/*`, `apps/web/src/routeTree.gen.ts`, `apps/landing/src/routeTree.gen.ts`, `apps/landing/.source/*`.
- Hand-edit generated API reference docs under `apps/landing/content/docs/api-reference/`; update `apps/landing/openapi.yaml` and regenerate instead.
- Use CSS-class selectors in E2E tests.
- Commit secrets or `.env*` files.
- Run `git push --force` or `git push --force-with-lease` without explicit user approval in the current thread. If a branch needs to be updated from `main` and the user did not explicitly request a rebase, prefer merging `main` into the branch.

## UNIQUE STYLES

- Large single-file route components exist in `apps/web/src/routes/` (avoid expanding unless refactoring).
- MCP server returns text payloads via tools/resources and logs to stderr only.
- Product/planning docs in `docs/` are mostly archival; published developer docs live in `apps/landing/content/docs/`.
- The landing site blends Fumadocs MDX, TanStack Start routes, and repo-managed content modules.

## COMMANDS

```bash
bun run dev
bunx turbo run dev --filter=@seal/web
bunx turbo run dev --filter=@seal/landing
bunx turbo run dev --filter=@seal/backend
bunx turbo run dev --filter=@seal/mcp-server
bunx turbo run dev --filter=@seal/transactional

bun run build
bun run lint
bun run format
bun run typecheck
bun run verify
bun run test

bunx turbo run test --filter=@seal/backend
bunx turbo run test --filter=@seal/web
bun --cwd apps/web run test:e2e
bun --cwd apps/landing run docs:generate:api
```

`bun run dev` starts the main product stack only: `@seal/backend` and `@seal/web`.
Use targeted `dev --filter=...` commands for other workspaces; `@seal/landing` and `@seal/transactional` both default to port `3001`.

## NOTES

- LSP codemap unavailable in this environment.
- Complexity hotspots: `apps/backend/convex/http.ts`, `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx`, `apps/web/src/routes/sign.$token.tsx`.

<!-- BEGIN VORTEX TOOLING MANAGED REVIEW GUIDELINES -->
## Review guidelines

* **Review the invariant, not the diff.** Trace what the changed code is *read by*, not just the changed lines. Removing or renaming a committed baseline, fixture, generated receipt, config, or guard that another script/workflow consumes silently disables it — REJECT unless the reader is deleted in the same PR. A green diff is not a safe diff.
* **Run the proof wall before approving** (typecheck/lint/build/test + `project-kit doctor`). Every finding must cite the failing command or the exact invariant it breaks — not a vibe. Satisfy the invariant, never just the sentence. On money/auth/data-loss/security, require a patch PLUS proof and a human gate.
* **NATIVE-FIRST — check the provider BEFORE you hand-roll.** A hand-rolled utility is a weaker solution 99% of the time; provider primitives move us far faster. Before writing any convex query helper, aggregation, pagination, rate-limiter, migration, retrier, or counter, you MUST first check **convex-helpers** (github.com/get-convex/convex-helpers — streams/QueryStreams, relationships, manual pagination, rate-limit, custom functions, validators) AND **Convex components** (convex.dev/components — Aggregate for O(log n) running totals, Sharded Counter, Migrations, Workflow, Action Retrier, Rate Limiter, Crons, …). Same discipline for every provider (Codex GitHub/Linear apps, Modal, LiveKit, Stripe Elements, better-auth, Convex). REJECT any PR that hand-rolls what a provider already ships. Vortex is WIRING, not reinvention — Core absorbs the provider primitive, consumers use it.
* **CORE-FIRST** — new auth/integrations/ui/email/payments/workflows in a consumer must come from a published `@vortexnyc/*` package, not be rebuilt locally. Never downgrade a `@vortexnyc/*` package to pass a check.
* **Rule of two:** if this PR introduces code that already exists in 2 or more Vortex codebases (helpers, gates, scripts, config patterns, Convex utilities), REJECT it — the primitive belongs in a published `@vortexnyc/*` package. Flag the duplication, name the repos, and require a Core lift ticket instead of a third copy.
* **pnpm only** (never npm/yarn/bun/npx). **Never** `any` (use `unknown` + narrow). **Never** `eslint-disable`/`biome-ignore`/`@ts-ignore`.
* **REMEDIATION INTEGRITY — a lint/type fix must change BEHAVIOR toward the rule's intent or prove the rule's documented non-applicability through a Core-owned ratchet, never just silence the report.** A check is a proxy; satisfying its letter while preserving the flagged behavior is gaming, and it is REJECTED even when the number hits zero. In any diff whose purpose is clearing a lint/type/convex finding: (a) it may NOT introduce a new named helper, wrapper, naming convention, or abstraction that merely relocates the flagged construct out of the matcher's reach (e.g. a `sequentialForEach`/`parallelForEach` wrapper, an async `.reduce`, a helper that hides an `await` from `no-await-in-loop`) — if a "fix lint" diff ADDS a function definition, that is a red flag, inspect it as gaming; (b) it may NOT add `as any`/`as unknown as`, a `void`-prefixed promise, or any broad suppression-shaped comment/allowlist/config entry; (c) it may NOT weaken a read that must return all rows (`.take(N)`/`.paginate()` on a money/aggregate path is a silent cap). The reviewer must confirm the fix altered execution semantics in the intended direction or that the rule does not apply — same behavior + green check without either proof = FAIL. Use the provider's native concurrency primitive when it owns the lifecycle (for example Convex **Workpool**/**Rate Limiter**). When correctness or a provider contract truly requires a raw serial loop — dependent pagination, bounded retry/backoff, or ordered event application — ratchet the exact reviewed source file under `lint.sequentialFiles` and require behavior proof. Wildcards, directories, and filename-based exemptions are forbidden. Prefer an adversarial second-pass review on remediation PRs: its job is to prove the fix is cosmetic.
* **Auth is Vortex Auth** (better-auth + Convex). **Clerk is always wrong.**
* **Convex cost** — no dynamic `ctx.db.query(table)`, no unindexed `.collect()` (whole-table scans blow the 16 MiB / 32k-doc limits).
* **Convex reads — use the RIGHT native tool, don't over-wrap.** Match the need, smallest tool that fits: (1) read all rows of ONE index → **native `for await (const x of ctx.db.query(t).withIndex(...))`** — the Convex query is async-iterable, lint-clean, no dependency. NEVER `.collect()`, and NEVER `.take(N)` on a money/aggregate read (a silent cap = wrong totals). (2) `await ctx.db.get(id)` inside a loop (`no-await-in-loop`) → convex-helpers **`getAll`/`getManyFrom`/`getManyVia`**. (3) merge/order across multiple index ranges → convex-helpers **`mergedStream`/`streamIndexRange`**. (4) cursor pagination → convex-helpers **`paginator`**. Helpers (2)–(4) come from **`@vortexnyc/convex/helpers`**. REJECT wrapping a plain single-index read in `stream()` — that's the power tool where the native iterator already does the job.
* **Untrusted input — parse against a validator, never cast.** `JSON.parse` returns `any`; `JSON.parse(x) as T` is a lie the type system cannot check and is the single largest source of `no-unsafe-type-assertion` across the fleet. Use **`parse(validator, value)`** (typed result, throws on mismatch) or **`validate(validator, value)`** (type guard) from **`@vortexnyc/convex/helpers`** — they re-export `convex-helpers/validators`, which imports only `convex/values`, so they work in Convex functions, packages AND Node scripts alike. The validators you already declared in `schema.ts` and in each function's `args` ARE the parser — do not hand-write a guard per shape. Pass `db` when a `v.id(table)` must be proven to belong to that table; without it `v.id` is only checked as a string. A remaining `as T` on a parsed payload means no validator was declared for that boundary — declare one.
* **Convex `ctx` code lives under `convex/`.** Any module that accepts a `QueryCtx`/`MutationCtx`/`ActionCtx` — helpers and runtime factories included, not just the query/mutation definitions — belongs in a `convex/` directory. Convex permits otherwise (`convex.json` only declares where FUNCTION DEFINITIONS live, so imported helpers may sit anywhere and still execute inside Convex), but the typed Convex lint tier globs `convex/` and `component/` only, so anything else is UNCHECKED. vortex-payments kept a 2501-line billing runtime in `apps/backend/src/` — 91 `ctx.db` sites, imported by 14 Convex functions — which silently accumulated 69 findings no gate could see. If pure logic must live outside, split it: the `ctx`-taking part moves under `convex/`, the rest stays. `project-kit doctor` fails on violations (`convex-code-outside-convex-dir`).
* **Money math — `@vortexnyc/money`, never hand-rolled.** Money is INTEGER minor units (no float storage). A bare `Math.round`/`Math.floor`/`Math.ceil`, `.toFixed`, `parseFloat`, or `/ 100`/`* 100` on a money amount is a REJECT — route it through Core: fractional rounding → `roundMinorUnits`/`applyRate`/`multiplyMoney`; major↔minor conversion → `fromMajorUnits`/`toMajorNumber`/`toMinorUnitsInt`; splitting an amount into parts → `allocate` (penny-safe largest-remainder, NEVER `total / n`); combining amounts that may differ in currency (cross-entity, multi-currency) → `sumMoney`/`addMoney`/`compareMoney` for the currency-mismatch guard; display → `formatMoney`. A raw integer `+`/`reduce` is acceptable ONLY for an exact same-currency minor-unit sum that cannot lose precision (e.g. summing one invoice's line amounts); anything that rounds, divides, converts, or crosses currencies must use the Core primitive. Rounding policy is **round-half-up, applied per line-item, then sum the integer minor units** — this MATCHES Stripe exactly (fee `0.025 → 0.03`; tax rounded at the invoice-item level to the smallest unit *before* totaling) and US banking. NEVER banker's/half-even — that diverges from Stripe. New raw-number money arithmetic in a consumer is CORE-FIRST debt: if a needed operation is missing, add it to `@vortexnyc/money` and consume it — never hand-roll in the consumer.
* **Test flavor** — a test that touches `ctx`/schema/`_generated` is a `.vitest.ts` using `convex-test` (edge-runtime); pure logic is a `.test.ts` run by `vitest` (`pnpm run test:unit`). NEVER `bun test` or `bun:test` APIs — bun is not the toolchain.
* **Supply never single-sourced** — model calls need the flat fallback chain (`ollama-cloud → opencode-go → openai/gpt-5.5`), never one provider, never a metered tier.
* **No secrets/PII in logs.** Auth middleware wraps every route. **No AI attribution** anywhere.
<!-- END VORTEX TOOLING MANAGED REVIEW GUIDELINES -->
