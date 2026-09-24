# PROJECT KNOWLEDGE BASE

<!-- [CLEAN] VAL-T2-SEAL-1777054289449: minimal edit pipeline proof -->

**Generated:** 2026-03-10 14:37 CET
**Commit:** f7b9cd2
**Branch:** main

## OVERVIEW

Seal is a pnpm + Vite+ (VoidZero) monorepo with a React 19 product app, a blume (Astro) static docs site, a marketing site, a Cloudflare Workers backend, transactional email templates, an embeddable React SDK, and shared design tokens. Auth is Better Auth on the Cloudflare Worker API (`apps/api`); the product UI uses Cloudflare Kumo. Product data lives in the Worker. **Seal does not use Vortex Core (`@vortexnyc/*`).** Core is retired — do not add it.

**Agent-native:** OpenAPI (`apps/docs/openapi.yaml`) is the product contract. MCP / CLI / SDK follow it. Agents operate the sender-side machine; humans provide signing intent. Agents are not signatories — see `docs/decisions/ADR-003-agent-native-openapi-and-signing.md` and docs `/getting-started/agents`.

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
| Architecture overview  | `README.md`, `apps/api/src/`, `docs/decisions/`                | Live stack only; ADR-003 = agents + signing |
| Agent / OpenAPI doctrine | `docs/decisions/ADR-003-agent-native-openapi-and-signing.md`, `apps/docs/docs/getting-started/agents.mdx` | Spec first; humans sign |
| Cloudflare Worker API  | `apps/api/src/`                                                | Hono + Drizzle + wrangler backend               |
| REST API routes        | `apps/api/src/api/`                                            | Public + internal API routes                      |
| Product web routing    | `apps/web/src/routes/`                                         | TanStack file-based routes                      |
| Product web entry      | `apps/web/src/main.tsx`                                        | Better-Auth + TanStack Query + Router setup     |
| Docs site config       | `apps/docs/blume.config.ts`                                    | blume site config, OpenAPI route                |
| Published docs content | `apps/docs/docs/`                                              | blume (Astro) MDX source                        |
| API spec source        | `apps/docs/openapi.yaml`                                       | OpenAPI spec rendered at `/reference` — **contract** |
| MCP tools/resources    | `apps/mcp-worker/src/tools/`, `apps/mcp-worker/src/resources/` | Must mirror OpenAPI                             |
| Email templates        | `packages/transactional/src/emails/`                           | React Email templates; email is a first-class channel |
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

<!-- BEGIN SEAL REVIEW GUIDELINES -->
## Review guidelines

Seal owns its stack. **Vortex Core (`@vortexnyc/*`) is dead for this repo** — never add it, never “lift to Core,” never reject a PR for not using Core.

* **OpenAPI is the contract.** Operational do/fetch belongs in `apps/docs/openapi.yaml` first. MCP / CLI / SDK wrap it — never invent parallel surfaces. Agents operate sender-side; **agents are not signatories** (ADR-003). SPA is oversight.
* **Review the invariant, not the diff.** Trace what the changed code is *read by*, not just the changed lines. Removing or renaming a committed baseline, fixture, generated receipt, config, or guard that another script/workflow consumes silently disables it — REJECT unless the reader is deleted in the same PR. A green diff is not a safe diff.
* **Run the proof wall before approving** (typecheck/lint/build/test). Every finding must cite the failing command or the exact invariant it breaks — not a vibe. On money/auth/data-loss/security, require a patch PLUS proof and a human gate.
* **NATIVE-FIRST — check the provider BEFORE you hand-roll.** Prefer Hono, Drizzle, Cloudflare primitives (D1, Durable Objects, R2, Queues, Workflows), Better Auth, Stripe Elements, Kumo. REJECT hand-rolls of what those providers already ship. Fix it in this repo or delete it — not by importing a dead Core package.
* **No `@vortexnyc/*`.** If a PR adds a Core dependency, REJECT it. In-repo packages (`@seal/*`, `@vortex-api/seal`, `@vortex-api/better-auth-ui`) and public npm are fine.
* **Delete duplication in-repo.** Prefer deletion and simplification over abstraction. Do not invent a shared package to satisfy portfolio dogma.
* **pnpm only** (never npm/yarn/bun/npx). **Never** `any` (use `unknown` + narrow). **Never** `eslint-disable`/`biome-ignore`/`@ts-ignore`.
* **REMEDIATION INTEGRITY — a lint/type fix must change BEHAVIOR toward the rule's intent or prove the rule does not apply — never just silence the report.** Do not add named helpers that only dodge a matcher, `as any`/`as unknown as`, voided promises, or broad suppressions. Do not weaken reads that must return all rows. Prefer provider concurrency (Queues, DO alarms, Drizzle transactions). Serial loops only when correctness requires them — then document why.
* **Auth is Better Auth on Cloudflare.** **Clerk is always wrong.**
* **Untrusted input — parse against a validator, never cast.** Use Zod at request/env boundaries and the Drizzle schema at DB boundaries.
* **Money math — `apps/web/src/lib/money.ts` only.** Integer minor units. Round-half-up (Stripe-aligned). No float storage. No `@vortexnyc/money`.
* **Test flavor** — vitest (`pnpm run test`). Never `bun test` / `bun:test`.
* **No secrets/PII in logs.** **No AI attribution** anywhere.
<!-- END SEAL REVIEW GUIDELINES -->
