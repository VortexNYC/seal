# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-26 13:04 -03
**Commit:** e65cf75
**Branch:** main

## OVERVIEW
Seal is a Bun + Turborepo monorepo: React 19 web app (TanStack Router + Vite), Convex backend, MCP server, and React Email templates. Auth via Clerk; UI Tailwind v4 + Shadcn.

## STRUCTURE
```
seal/
├── apps/               # web, backend, mcp-server
├── packages/           # transactional emails
├── tooling/            # shared TypeScript config
├── docs/               # architecture, design, feature specs
├── scripts/linear/     # prefer over MCP for Linear
├── .mcp.json           # MCP server config
└── bunfig.toml
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Architecture overview | `docs/DOCUMENTATION_INDEX.md` | Start here; role/task routing |
| Permissions & roles | `docs/ROLES_AND_PERMISSIONS.md` | Two-tier access model |
| Backend auth wrappers | `apps/backend/convex/auth.ts` | Always use wrappers |
| Backend permissions | `apps/backend/convex/auth.utils.ts` | Role hierarchy + permissions |
| REST API v1 | `apps/backend/convex/api/v1/` | Public API endpoints |
| Web routing | `apps/web/src/routes/` | TanStack file-based routes |
| Web entry | `apps/web/src/main.tsx` | Clerk + Convex + Router setup |
| MCP tools/resources | `apps/mcp-server/src/tools/`, `apps/mcp-server/src/resources/` | MCP server surface |
| Email templates | `packages/transactional/src/emails/` | React Email templates |
| E2E tests | `apps/web/e2e/` | Playwright POM pattern |

## SUBDIRECTORY GUIDES
- `apps/web/AGENTS.md`
- `apps/backend/convex/AGENTS.md`
- `apps/mcp-server/AGENTS.md`
- `packages/transactional/AGENTS.md`

## CONVENTIONS (PROJECT-SPECIFIC)
- TypeScript strict: no `any`, `@ts-ignore`, `@ts-expect-error`, `as any`; exported functions have explicit return types.
- Convex backend: use auth wrappers; commit `apps/backend/convex/_generated/`.
- Routes: TanStack file-based; `apps/web/src/routeTree.gen.ts` is generated.
- E2E: Playwright page objects; prefer `data-testid` selectors.

## ANTI-PATTERNS (THIS PROJECT)
- Raw Convex `query`/`mutation` without wrappers.
- Modify `apps/backend/convex/schemas/subscription_coupons.ts` or `apps/backend/convex/schemas/subscription_promo_codes.ts` directly.
- Update `creditsUsed` in `apps/backend/convex/stripe/handlers.ts` (preserve usage history).
- Edit generated files: `apps/backend/convex/_generated/*`, `apps/web/src/routeTree.gen.ts`.
- Use CSS-class selectors in E2E tests.
- Commit secrets or `.env*` files.

## UNIQUE STYLES
- Large single-file route components exist in `apps/web/src/routes/` (avoid expanding unless refactoring).
- MCP server returns text payloads via tools/resources and logs to stderr only.
- Docs are design-led: feature specs + user flows + wireframes in `docs/features/`.

## COMMANDS
```bash
bunx turbo run dev --parallel
bunx turbo run dev --filter=@seal/web
bunx turbo run dev --filter=@seal/backend
bunx turbo run dev --filter=@seal/transactional

bun run build
bun run lint
bun run format
bun run typecheck
bun run static-analysis

bunx turbo run test --filter=@seal/backend
bun run test:e2e
```

## NOTES
- LSP codemap unavailable in this environment.
- Complexity hotspots: `apps/backend/convex/http.ts`, `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx`, `apps/web/src/routes/sign.$token.tsx`.
