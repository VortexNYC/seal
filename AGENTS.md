# Seal Repository Guidelines

Seal: Bun + Turborepo monorepo. `apps/web` (React 19, TanStack Router, Vite), `apps/backend` (Convex), `packages/transactional` (React Email). Auth: Clerk. UI: Tailwind v4 + Shadcn. Linting: Biome.

## Commands

```bash
# Development
bunx turbo run dev --parallel                    # Start all services
bunx turbo run dev --filter=@seal/web            # Web only
bunx turbo run dev --filter=@seal/backend        # Backend only

# Build & Analysis
bun run build                                    # Build all
bun run lint                                     # Lint all
bun run typecheck                                # TypeScript check
bun run static-analysis                          # Biome + TypeScript (run before commits)

# E2E Tests (from apps/web)
bun run test:e2e                                 # Run all tests
bun run test:e2e e2e/tests/documents.spec.ts     # Single file
bun run test:e2e -g "should create document"     # Pattern match
bun run test:e2e:ui                              # Interactive UI mode
bun run test:e2e:headed                          # See browser
bun run test:e2e:debug                           # Debug with Inspector
bun run test:e2e:report                          # View HTML report
```

## Code Style

### TypeScript (Strict)
- **NEVER** use `any`, `@ts-ignore`, `@ts-expect-error`, `as any`
- Always explicit return types on exported functions
- `strictNullChecks: true`, `noUncheckedIndexedAccess: true`

### Biome Rules (Enforced)
```
noExplicitAny: error       noUnusedVariables: error     noUnusedImports: error
noDoubleEquals: error      noDebugger: error            useHookAtTopLevel: error
```

### Naming
- **Components/Convex**: PascalCase (`DocumentPage.tsx`, `Documents.ts`)
- **Utils/hooks**: kebab-case (`test-helpers.ts`, `use-billing-portal.ts`)
- **Variables/functions**: camelCase (`getUserPermissions`, `documentId`)

### Imports (Biome auto-sorts)
1. External libs (`react`, `convex/values`)
2. Workspace packages (`@seal/backend`, `@seal/transactional`)
3. Relative (`./components`, `../utils`)

### Error Handling
- `try/catch` for async, `ConvexError` for backend, React Error Boundaries for UI
- **NEVER** commit secrets or credentials

## Convex Backend

### ALWAYS Commit Generated Files
```bash
apps/backend/convex/_generated/   # MUST be committed
```

### Auth Wrappers (REQUIRED - never use raw query/mutation)
```typescript
import { authQuery, authMutation, permissionMutation, adminMutation } from "../auth";

export const getDocument = authQuery({ ... });                           // Any authenticated user
export const createDocument = permissionMutation("documents:create")({ ... }); // Specific permission
export const updateRole = adminMutation({ ... });                        // Admin/owner only
```

| Wrapper | Use Case |
|---------|----------|
| `authQuery/Mutation` | Any authenticated user with active membership |
| `memberQuery/Mutation` | Requires `member` role or higher |
| `adminQuery/Mutation` | Requires `admin` or `owner` role |
| `permissionQuery/Mutation(perm)` | Requires specific permission string |

### Permission Strings (see `auth.utils.ts`)
```
documents:create  documents:read  documents:delete  templates:create  templates:use
org:users:invite  subscription:manage  audit:read  api:create
```

### Mutation Pattern
```typescript
export const myMutation = permissionMutation("documents:create")({
  args: { name: v.string(), organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;  // ctx.auth has user, member, organization, hasPermission()
    
    const member = await ctx.db.query("organization_members")
      .withIndex("by_user_organization", q => q.eq("userId", userId).eq("organizationId", args.organizationId))
      .first();
    
    if (!member || member.status !== "active") throw new ConvexError("Not authorized");
    return await ctx.db.insert("documents", { ... });
  },
});
```

## Frontend

### Imports
```typescript
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";  // Path alias
```

### Permission-Based UI
```typescript
if (!permissions?.permissions.canCreateDocuments) return <PermissionDenied />;
```

## E2E Testing

### Structure (Page Object Model)
```typescript
import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";

test.describe("Feature", () => {
  test("should do X", async ({ authenticatedPage, organizationSlug }) => {
    const page = new DocumentPage(authenticatedPage);
    await page.goto(organizationSlug, documentId);
    await expect(authenticatedPage.locator('[data-testid="success"]')).toBeVisible();
  });
});
```

### Selectors (preference order)
1. `data-testid`: `[data-testid="document-title"]`
2. Semantic: `getByRole('button', { name: 'Save' })`
3. Label: `getByLabel('Email')`
4. **AVOID**: CSS classes, complex DOM paths

## Key Files

| Purpose | Location |
|---------|----------|
| Auth wrappers | `apps/backend/convex/auth.ts` |
| Permissions | `apps/backend/convex/auth.utils.ts`, `auth/permissions.ts` |
| Schemas | `apps/backend/convex/schemas/*.ts` |
| E2E fixtures | `apps/web/e2e/fixtures/auth.ts` |
| Page objects | `apps/web/e2e/pages/**/*.ts` |
| UI components | `apps/web/src/components/ui/*.tsx` |
| Biome config | `biome.jsonc` |

## Commits

- **Conventional**: `fix:`, `feat:`, `chore:`, `docs:`, `refactor:`
- **Pre-commit**: `bun run static-analysis`
- **Never commit**: `.env`, secrets
- **Always commit**: `apps/backend/convex/_generated/`
