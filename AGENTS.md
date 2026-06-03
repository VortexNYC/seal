# PROJECT KNOWLEDGE BASE

<!-- [CLEAN] VAL-T2-SEAL-1777054289449: minimal edit pipeline proof -->

**Generated:** 2026-03-10 14:37 CET
**Commit:** f7b9cd2
**Branch:** main

## OVERVIEW

Seal is a Bun + Turborepo monorepo with a React 19 product app, a TanStack Start landing/docs site, a Convex backend, an MCP server, transactional email templates, an embeddable React SDK, and shared design tokens. Auth uses Better-Auth (via @plasmapos/vortex-auth); the product UI uses Tailwind v4 + Shadcn patterns.

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
- Update `creditsUsed` in `apps/backend/convex/stripe/handlers.ts` (preserve usage history).
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
