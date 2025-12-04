# Repository Guidelines

## Overview
- Seal is a Bun + Turborepo monorepo with React 19 + TanStack Router (Vite) on the frontend, Convex on the backend, Clerk for auth, Tailwind v4 + Shadcn UI, and Stripe/Resend integrations.
- Main apps live in `apps/web` (client) and `apps/backend` (Convex). Shared packages sit under `packages/`, and automation/tools under `tooling/`. Product docs belong in `docs/`.

## Project Structure & Module Organization
- `apps/backend/convex` hosts Convex serverless functions grouped by domain folders (`organizations/`, `stripe/`, shared `validations/`). Keep generated code in `_generated/`.
- `apps/web/src` contains the Vite + React client: `routes/` drives TanStack Router, `components/` holds UI primitives, and `lib/` centralizes helpers. Integrations (Clerk/Convex) live under `src/integrations/`.
- `packages/transactional` stores React Email templates; `tooling/` contains Linear/tsconfig helpers.
- Shared configuration (`turbo.json`, `tsconfig.json`, `biome.jsonc`) lives at the root.

## Build, Test, and Development Commands
- `bun install` syncs workspace dependencies (Bun 1.3.x required).
- Run both dev servers with `bunx turbo run dev --parallel`; target one app with `bunx turbo run dev --filter=@seal/web` or `--filter=@seal/backend`.
- `bun run build` produces deployable artifacts (Vercel entry point).
- `bun run lint`, `bun run format`, and `bun run typecheck` enforce Biome linting/formatting and TS checks.
- Clean caches/node_modules with `bun run clean` or `bun run clean:workspaces`.

## Testing Guidelines
- Frontend unit/integration tests use Vitest + Testing Library in `apps/web` (run `bunx vitest` from that workspace until scripts are added). Place specs alongside source as `*.test.tsx` or within `__tests__/` mirroring component/route names.
- E2E tests run via Playwright in `apps/web` (`bun run test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:debug`, `test:e2e:codegen`).
- Stub Convex and Clerk boundaries with provided mocks to keep tests deterministic. Target meaningful coverage for new hooks/components.

## Coding Style & Naming Conventions
- TypeScript everywhere; avoid `any` (Biome error) and lean on strict typings.
- React components and Convex actions use PascalCase filenames (`TeamDashboard.tsx`), while shared utilities stay kebab-case.
- Let Biome formatters decide spacing/quotes. Run `bun run format` before pushing.
- Prefer descriptive names (`useBillingPortal`, `upsertOrganization`) and colocate related hooks, styles, and tests.
- Import organization: external libs first, then internal workspace packages, then relative imports.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`fix:`, `chore:`, `feat:`) and keep commits focused.
- Verify `bun run build`, lint, typecheck, and relevant tests before pushing.
- Pull requests should link Linear tickets, describe backend schema or env changes, and include UI screenshots when applicable.
- Request review once a Vercel preview (or local equivalent) passes and secrets/config updates are documented.

## Error Handling & Security
- Use try/catch for async operations; prefer error boundaries in React.
- Required keys live in `.env` files (`VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, Stripe secrets). Never commit credentials.
- Use `convex dev` for local data and Stripe test keys by default; production tokens belong only in Vercel-managed env vars.
