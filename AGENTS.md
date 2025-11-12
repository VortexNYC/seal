# Repository Guidelines

## Project Structure & Module Organization
- `apps/backend/convex` hosts Convex serverless functions grouped by domain folders (`organizations/`, `stripe/`, shared `validations/`). Keep generated code in `_generated/`.
- `apps/web/src` contains the Vite + React 19 client: `routes/` drives TanStack Router, `components/` holds UI primitives, and `lib/` centralizes helpers.
- `tooling/` stores Linear automation scripts consumed by the CLI utilities in the project root.
- Shared configuration (`turbo.json`, `tsconfig.json`, `biome.jsonc`) lives at the root; product docs belong under `docs/`.

## Build, Test, and Development Commands
- `bun install` syncs all workspace dependencies (Bun 1.3 required).
- `bun run dev` starts the Turbo-powered dev graph (Vite UI + Convex backend).
- `bun run --filter @seal/web dev` or `bun run --filter @seal/backend dev` to focus on a single app.
- `bun run build` produces deployable artifacts; this is the Vercel build entry point.
- `bun run lint`, `bun run format`, and `bun run typecheck` enforce Biome linting/formatting and TS checks.

## Coding Style & Naming Conventions
- TypeScript everywhere; avoid `any` (Biome error) and lean on strict typings.
- React components and Convex actions use PascalCase filenames (`TeamDashboard.tsx`), while shared utilities stay kebab-case.
- Let Biome formatters decide spacing/quotes. Run `bun run format` before pushing.
- Prefer descriptive names (`useBillingPortal`, `upsertOrganization`) and colocate related hooks, styles, and tests.
- Import organization: external libs first, then internal workspace packages, then relative imports.

## Testing Guidelines
- Frontend unit/integration tests use Vitest + Testing Library. Run `bun run --filter @seal/web test` or `bun run --filter @seal/web test path/to/test.test.tsx` for single test.
- Place specs alongside source as `*.test.tsx` or within `__tests__/`; mirror component or route names.
- Stub Convex and Clerk boundaries with provided mocks to keep tests deterministic.
- Target meaningful coverage for new hooks/components; use `bun run --filter @seal/web test -- --coverage` when refactoring.

## Commit & Pull Request Guidelines
- Follow the repo’s Conventional Commit style (`fix:`, `chore:`, `feat:`) and keep commits focused.
- Verify `bun run build`, lint, typecheck, and relevant tests before pushing.
- Pull requests should link Linear tickets, describe backend schema or env changes, and include UI screenshots when applicable.
- Request review once a Vercel preview (or local equivalent) passes and secrets/config updates are documented.

## Error Handling & Security
- Use try/catch for async operations, prefer error boundaries in React.
- Required keys live in `.env` files (`VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, Stripe secrets). Never commit credentials.
- Use `convex dev` for local data and Stripe test keys by default; production tokens belong only in Vercel-managed env vars.
