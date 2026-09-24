# PROJECT KNOWLEDGE BASE

<!-- [CLEAN] VAL-T2-SEAL-1777054289449: minimal edit pipeline proof -->

**Generated:** 2026-03-10 14:37 CET
**Commit:** f7b9cd2
**Branch:** main

## OVERVIEW

Seal is a pnpm + Vite+ (VoidZero) monorepo with a React 19 product app, a blume (Astro) static docs site, a marketing site, a Cloudflare Workers backend, transactional email templates, an embeddable React SDK, and shared design tokens. Auth uses Better-Auth through Vortex Auth (`@vortexnyc/auth`); the product UI uses Cloudflare Kumo. Product data lives in the Cloudflare Worker API (`apps/api`).

## STRUCTURE

```text
seal/
├── apps/               # web, docs, site, api, mcp-worker, anydoc-worker, convert-worker
├── packages/           # sdk, transactional, tokens, internal-auth
├── tooling/            # shared TypeScript config
└── docs/               # ADRs, brand bootstrap, active specs only
```

## WHERE TO LOOK

| Task                   | Location                                                       | Notes                                           |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Architecture overview  | `README.md`, `apps/api/src/`, `docs/decisions/`                | Live stack only                                 |
| Cloudflare Worker API  | `apps/api/src/`                                                | Hono + Drizzle + wrangler backend               |
| REST API routes        | `apps/api/src/api/`                                            | Public + internal API routes                      |
| Product web routing    | `apps/web/src/routes/`                                         | TanStack file-based routes                      |
| Product web entry      | `apps/web/src/main.tsx`                                        | Better-Auth + TanStack Query + Router setup     |
| Docs site config       | `apps/docs/blume.config.ts`                                    | blume site config, OpenAPI route                |
| Published docs content | `apps/docs/docs/`                                              | blume (Astro) MDX source                        |
| API spec source        | `apps/docs/openapi.yaml`                                       | OpenAPI spec rendered at `/reference`           |
| MCP tools/resources    | `apps/mcp-worker/src/tools/`, `apps/mcp-worker/src/resources/` | MCP worker surface                              |
| Email templates        | `packages/transactional/src/emails/`                           | React Email templates                           |
| SDK                    | `packages/sdk/src/`                                            | `@vortex-api/seal` — client, React components, CLI |
| Shared design tokens   | `packages/tokens/src/`                                         | Shared fonts/theme exports                      |
| Brand system / assets  | `docs/brand-bootstrap.md`                                      | Mark, palette, fonts, OG/favicon render pipeline — reuse for other products |
| E2E tests              | `apps/web/e2e/`                                                | Playwright POM pattern                          |

## SUBDIRECTORY GUIDES

- `apps/web/AGENTS.md`
- `packages/transactional/AGENTS.md`

## CONVENTIONS (PROJECT-SPECIFIC)

- TypeScript strict: no `any`, `@ts-ignore`, `@ts-expect-error`, `as any`; exported functions have explicit return types.
- Cloudflare Worker backend (`apps/api`): use Hono + Drizzle + wrangler; native-first auth/storage.
- Routes: TanStack file-based; `apps/web/src/routeTree.gen.ts` is generated.
- Docs: `apps/docs/dist/*` is a generated artifact; regenerate via `pnpm --dir apps/docs run build` instead of hand-editing.
- E2E: Playwright page objects; prefer `data-testid` selectors.

## ANTI-PATTERNS (THIS PROJECT)

- Mutate historical usage counters directly; preserve usage history through documented payment projections.
- Edit generated files: `apps/web/src/routeTree.gen.ts`, `apps/docs/dist/*`.
- Let the API reference drift from `apps/docs/openapi.yaml`; the spec is the source of truth rendered at `/reference`.
- Use CSS-class selectors in E2E tests.
- Commit secrets or `.env*` files.
- Run `git push --force` or `git push --force-with-lease` without explicit user approval in the current thread. If a branch needs to be updated from `main` and the user did not explicitly request a rebase, prefer merging `main` into the branch.

## UNIQUE STYLES

- Large single-file route components exist in `apps/web/src/routes/` (avoid expanding unless refactoring).
- MCP server returns text payloads via tools/resources and logs to stderr only.
- Product ADRs / brand / active specs live in `docs/`; published developer docs live in `apps/docs/docs/`.
- The docs site is a `blume` (Astro) static build with MDX content modules and an OpenAPI reference at `/reference`.

## COMMANDS

```bash
pnpm run dev
pnpm --filter @seal/api run dev
pnpm --filter @seal/web run dev
pnpm --filter @seal/docs run dev
pnpm --filter @seal/mcp-worker run dev
pnpm --filter @seal/transactional run dev

pnpm run build
pnpm run lint
pnpm run format
pnpm run typecheck
pnpm run verify
pnpm run test

pnpm --filter @seal/api run test
pnpm --filter @seal/web run test
pnpm --dir apps/web run test:e2e
pnpm --dir apps/docs run build
```

`pnpm run dev` starts the main product stack: `@seal/api`, `@seal/web`, and `@seal/docs`.
Use targeted `pnpm --filter ... run dev` commands for other workspaces; `@seal/transactional` defaults to port `3001`.

## CI/CD — owned by cloudflare-ci

Deploys run through the shared `cloudflare-ci` worker (`~/Projects/cloudflare-ci`),
triggered by pushes to the `vortex` Artifacts namespace — not by a GitHub Actions
deploy pipeline. Pipeline: `deps → build → preview (branches) / migrate+deploy (main)`.

GitHub Actions kept here (narrow roles only):

- `artifacts-sync.yml` — mirrors every push into the Artifacts git remote that
  triggers cloudflare-ci. This is the sync bridge, not a deploy.
- `secrets.yml` — manual-dispatch upload/verify of Worker secrets
  (`wrangler secret put`). cloudflare-ci has no secrets path yet; when it does,
  delete this workflow.

Do not reintroduce `deploy.yml` / `migrate.yml` / `ci.yml`. Checks/tests gate
locally via the `vp` pre-push hook.

- `pnpm run build:all` must emit `dist/` **and** `.wrangler/deploy/config.json`
  per app (Astro/Vite wrangler redirect) — CI snapshots carry both forward;
  preview/deploy only `wrangler versions upload`/`deploy`, never rebuild.
- Keep `VP_GIT_HOOKS=0` behavior out of repo code.
- If CI behavior is wrong (timeouts, caching, capacity, deploy shape), fix it
  in `cloudflare-ci` — do not add workflow files, hook packages, or config
  workarounds here.

## NOTES

- LSP codemap unavailable in this environment.
- Complexity hotspots: `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx`, `apps/web/src/routes/sign.$token.tsx`.
- D1 migrations: `drizzle-kit generate` can emit full-schema snapshots when `migrations/meta/_journal.json` is out of sync with existing `.sql` files. Use manual incremental `.sql` migrations and keep `_journal.json` aligned; `readD1Migrations` / `applyD1Migrations` in tests apply all `.sql` files in filename order.

<!-- BEGIN VORTEX TOOLING MANAGED REVIEW GUIDELINES -->
## Review guidelines

* **Review the invariant, not the diff.** Trace what the changed code is *read by*, not just the changed lines. Removing or renaming a committed baseline, fixture, generated receipt, config, or guard that another script/workflow consumes silently disables it — REJECT unless the reader is deleted in the same PR. A green diff is not a safe diff.
* **Run the proof wall before approving** (typecheck/lint/build/test + `project-kit doctor`). Every finding must cite the failing command or the exact invariant it breaks — not a vibe. Satisfy the invariant, never just the sentence. On money/auth/data-loss/security, require a patch PLUS proof and a human gate.
* **NATIVE-FIRST — check the provider BEFORE you hand-roll.** A hand-rolled utility is a weaker solution 99% of the time; provider primitives move us far faster. Before writing any query helper, aggregation, pagination, rate-limiter, migration, retrier, or counter for the Worker, check Hono, Drizzle, Cloudflare primitives (D1, Durable Objects, R2, Queues, Workflows), and Better Auth first. Same discipline for every provider (Codex GitHub/Linear apps, Modal, LiveKit, Stripe Elements, Better Auth). REJECT any PR that hand-rolls what a provider already ships. Vortex is WIRING, not reinvention — Core absorbs the provider primitive, consumers use it.
* **CORE-FIRST does not apply to Seal.** Seal stays off `@vortexnyc/*` Core packages. Prefer Cloudflare / Better Auth / Kumo / in-repo packages. Do not introduce Core deps to “fix” a review finding.
* **Rule of two (Seal):** prefer deleting duplication inside this repo over lifting to Core. A third copy across Vortex products is not a reason to pull Core into Seal.
* **pnpm only** (never npm/yarn/bun/npx). **Never** `any` (use `unknown` + narrow). **Never** `eslint-disable`/`biome-ignore`/`@ts-ignore`.
* **REMEDIATION INTEGRITY — a lint/type fix must change BEHAVIOR toward the rule's intent or prove the rule's documented non-applicability through a Core-owned ratchet, never just silence the report.** A check is a proxy; satisfying its letter while preserving the flagged behavior is gaming, and it is REJECTED even when the number hits zero. In any diff whose purpose is clearing a lint/type finding: (a) it may NOT introduce a new named helper, wrapper, naming convention, or abstraction that merely relocates the flagged construct out of the matcher's reach (e.g. a `sequentialForEach`/`parallelForEach` wrapper, an async `.reduce`, a helper that hides an `await` from `no-await-in-loop`) — if a "fix lint" diff ADDS a function definition, that is a red flag, inspect it as gaming; (b) it may NOT add `as any`/`as unknown as`, a `void`-prefixed promise, or any broad suppression-shaped comment/allowlist/config entry; (c) it may NOT weaken a read that must return all rows (`.take(N)`/`.paginate()` on a money/aggregate path is a silent cap). The reviewer must confirm the fix altered execution semantics in the intended direction or that the rule does not apply — same behavior + green check without either proof = FAIL. Use the provider's native concurrency primitive when it owns the lifecycle (for example Cloudflare **Queues** / **Durable Object alarms** / **Drizzle transactions**). When correctness or a provider contract truly requires a raw serial loop — dependent pagination, bounded retry/backoff, or ordered event application — ratchet the exact reviewed source file under `lint.sequentialFiles` and require behavior proof. Wildcards, directories, and filename-based exemptions are forbidden. Prefer an adversarial second-pass review on remediation PRs: its job is to prove the fix is cosmetic.
* **Auth is Vortex Auth** (better-auth + Cloudflare). **Clerk is always wrong.**
* **Untrusted input — parse against a validator, never cast.** `JSON.parse` returns `any`; `JSON.parse(x) as T` is a lie the type system cannot check. Use Zod (`z.object(...).parse(value)` or `.safeParse()`) at every request/env/boundary in the Worker, and the Drizzle schema for database boundaries. A remaining `as T` means no validator was declared for that boundary — declare one.
* **Money math — Seal-local `apps/web/src/lib/money.ts`, never `@vortexnyc/money`.** Money is INTEGER minor units (no float storage). Route rounding/conversion/split/display through that module (`fromMajorUnits`, `allocate`, `applyRate`, `formatMoney`, …). Do not add `@vortexnyc/money`. Rounding policy is **round-half-up** (Stripe-aligned); do not default to banker's/half-even for money amounts.
* **Test flavor** — tests run with vitest (`pnpm run test`). NEVER `bun test` or `bun:test` APIs — bun is not the toolchain.
* **Supply never single-sourced** — model calls need the flat fallback chain (`ollama-cloud → opencode-go → openai/gpt-5.5`), never one provider, never a metered tier.
* **No secrets/PII in logs.** Auth middleware wraps every route. **No AI attribution** anywhere.
<!-- END VORTEX TOOLING MANAGED REVIEW GUIDELINES -->
