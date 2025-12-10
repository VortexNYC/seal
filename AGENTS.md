# Repository Guidelines

Seal: Bun + Turborepo monorepo. `apps/web` (React 19, TanStack Router, Vite), `apps/backend` (Convex). Auth: Clerk. UI: Tailwind v4 + Shadcn.

## Commands
- **Dev**: `bunx turbo run dev --parallel` (or `--filter=@seal/web` / `--filter=@seal/backend`)
- **Build/Lint/Types**: `bun run build`, `bun run lint`, `bun run format`, `bun run typecheck`
- **Unit tests**: `cd apps/web && bunx vitest` (single: `bunx vitest path/to/file.test.tsx`)
- **E2E tests**: `cd apps/web && bun run test:e2e` (single: `bun run test:e2e e2e/tests/file.spec.ts`)

## Code Style
- **Types**: Never use `any` (Biome error). Always explicit types.
- **Naming**: PascalCase for components/Convex files, kebab-case for utils. Descriptive names (`useBillingPortal`).
- **Imports**: External libs → workspace packages → relative imports. Biome handles formatting.
- **Errors**: try/catch for async; React error boundaries. Never commit secrets.

## Convex
- Always commit `apps/backend/convex/_generated/` folder.
- Use permission wrappers: `authQuery`, `permissionMutation("documents:create")`, `adminQuery`.

## Commits
- Conventional Commits (`fix:`, `feat:`, `chore:`). Run lint + typecheck before pushing.
