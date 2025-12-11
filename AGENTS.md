# Repository Guidelines

Seal: Bun + Turborepo monorepo. `apps/web` (React 19, TanStack Router, Vite), `apps/backend` (Convex). Auth: Clerk. UI: Tailwind v4 + Shadcn.

## Commands
- **Dev**: `bunx turbo run dev --parallel` (or `--filter=@seal/web` / `--filter=@seal/backend`)
- **Build/Lint/Types**: `bun run build`, `bun run lint`, `bun run format`, `bun run typecheck`
- **E2E tests**: `cd apps/web && bun run test:e2e` (single: `bun run test:e2e e2e/tests/file.spec.ts`)
- **E2E UI mode**: `cd apps/web && bun run test:e2e:ui` (interactive testing)

## Code Style
- **Types**: Never use `any` (Biome error). Always explicit types. No implicit `any`.
- **Naming**: PascalCase for components/Convex files, kebab-case for utils. Descriptive names (`useBillingPortal`).
- **Imports**: External libs → workspace packages → relative imports. Biome auto-formats.
- **Errors**: try/catch for async operations; React error boundaries. Never commit secrets.
- **Linting**: `noExplicitAny` error, `noUnusedVariables` error, `noUnusedImports` error.

## Convex
- Always commit `apps/backend/convex/_generated/` folder.
- Use permission wrappers: `authQuery`, `permissionMutation("documents:create")`, `adminQuery`.

## Commits
- Conventional Commits (`fix:`, `feat:`, `chore:`). Run lint + typecheck before pushing.
