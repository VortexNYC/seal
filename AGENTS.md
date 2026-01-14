# Seal Repository Guidelines

Seal: Bun + Turborepo monorepo. `apps/web` (React 19, TanStack Router, Vite), `apps/backend` (Convex), `packages/transactional` (React Email). Auth: Clerk. UI: Tailwind v4 + Shadcn. Linting: Biome. Testing: Vitest + Playwright.

## Commands

### Development
```bash
bunx turbo run dev --parallel                    # Start all services
bunx turbo run dev --filter=@seal/web            # Web only
bunx turbo run dev --filter=@seal/backend        # Backend only
bunx turbo run dev --filter=@seal/transactional  # Email templates only
```

### Build & Analysis
```bash
bun run build                                    # Build all
bun run lint                                     # Lint all (Biome)
bun run format                                   # Format all (Biome)
bun run typecheck                                # TypeScript check
bun run knip                                     # Find unused dependencies/files
bun run static-analysis                          # Biome + TypeScript + Knip (run before commits)
```

### Testing
```bash
# Unit tests (apps/backend)
bunx turbo run test --filter=@seal/backend
bunx turbo run test:watch --filter=@seal/backend

# E2E Tests (from apps/web)
bun run test:e2e                                 # Run all tests
bun run test:e2e e2e/tests/documents.spec.ts     # Single file
bun run test:e2e -g "should create document"     # Pattern match
bun run test:e2e:ui                              # Interactive UI mode
bun run test:e2e:headed                          # See browser
bun run test:e2e:debug                           # Debug with Inspector
bun run test:e2e:report                          # View HTML report
bun run test:e2e:codegen http://localhost:5173   # Generate tests
```

### Backend Operations
```bash
# From apps/backend directory
bunx convex dev                                  # Start Convex dev server
bunx convex deploy                               # Deploy to production
bunx convex dashboard                            # Open Convex dashboard
```

### Email Templates (Transactional)
```bash
# From packages/transactional directory
bun run dev                                      # Start email dev server (port 3001)
bun run export                                   # Export email templates
```

## Code Style

### TypeScript (Strict Mode - NO EXCEPTIONS)
- **NEVER** use `any`, `@ts-ignore`, `@ts-expect-error`, `as any`
- Always explicit return types on exported functions
- `strict: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`, `checkJs: false`

### Biome Rules (Enforced)
```json
{
  "noExplicitAny": "error",
  "noUnusedVariables": "error",
  "noUnusedImports": "error",
  "noDoubleEquals": "error",
  "noDebugger": "error",
  "useHookAtTopLevel": "error",
  "noArrayIndexKey": "off",
  "noAssignInExpressions": "off",
  "noConsole": { "level": "warn", "options": { "allow": ["info", "warn", "error", "debug", "log"] } }
}
```

### Naming Conventions
- **Components/Convex Functions**: PascalCase (`DocumentPage.tsx`, `Documents.ts`, `CreateDocument`)
- **Utils/Hooks/Files**: kebab-case (`test-helpers.ts`, `use-billing-portal.ts`, `auth-utils.ts`)
- **Variables/Functions**: camelCase (`getUserPermissions`, `documentId`, `isAuthenticated`)
- **Constants**: UPPER_SNAKE_CASE (`ROLE_HIERARCHY`, `DOCUMENT_PERMISSIONS`)
- **Types/Interfaces**: PascalCase (`AuthContext`, `DocumentData`)

### Imports (Biome auto-sorts)
```typescript
// 1. External libs (react, convex/values, @tanstack/*)
import { useState } from "react";
import { v } from "convex/values";

// 2. Workspace packages (@seal/backend, @seal/transactional)
import { api } from "@seal/backend/convex/_generated/api";

// 3. Relative imports (./components, ../utils)
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

### Error Handling
- Backend: `ConvexError` for authorization, validation errors
- Frontend: React Error Boundaries for UI errors
- Async operations: `try/catch` with proper error propagation
- **NEVER** commit secrets, credentials, or sensitive data

## Convex Backend

### ALWAYS Commit Generated Files
```bash
apps/backend/convex/_generated/   # MUST be committed
```

### Auth Wrappers (REQUIRED - Never use raw query/mutation)
```typescript
import { authQuery, authMutation, permissionMutation, adminMutation, memberMutation } from "../auth";

export const getDocument = authQuery({ ... });                           // Any authenticated user
export const createDocument = permissionMutation("documents:create")({ ... }); // Specific permission
export const updateRole = adminMutation({ ... });                        // Admin/owner only
export const listMembers = memberMutation({ ... });                      // Member role or higher
```

| Wrapper | Use Case |
|---------|----------|
| `authQuery/Mutation` | Any authenticated user with active membership |
| `memberQuery/Mutation` | Requires `member` role or higher |
| `adminQuery/Mutation` | Requires `admin` or `owner` role |
| `permissionQuery/Mutation(perm)` | Requires specific permission string |

### Permission System
```typescript
// Permission strings (see auth.utils.ts)
"documents:create", "documents:read", "documents:edit", "documents:delete",
"documents:send", "documents:cancel", "documents:download", "documents:share",
"templates:create", "templates:use", "templates:read", "templates:edit",
"org:manage", "org:users:invite", "org:users:remove", "org:users:update_role",
"subscription:manage", "audit:read", "api:create", "webhooks:create"

// Role hierarchy: system > owner > admin > member > viewer
```

### Mutation Pattern
```typescript
export const myMutation = permissionMutation("documents:create")({
  args: {
    name: v.string(),
    organizationId: v.id("organizations")
  },
  handler: async (ctx, args) => {
    const { user, member, organization, hasPermission } = ctx.auth;

    // Validation
    if (!hasPermission("documents:create")) {
      throw new ConvexError("Insufficient permissions");
    }

    // Business logic
    return await ctx.db.insert("documents", {
      name: args.name,
      organizationId: args.organizationId,
      createdBy: user._id,
    });
  },
});
```

### Auth Context Properties
```typescript
interface AuthContext {
  member: Doc<"organization_members">;
  user: Doc<"users">;
  organization: Doc<"organizations">;
  subscription?: Doc<"subscriptions">;

  // Utility methods
  hasPermission: (permission: string) => boolean;
  hasRole: (role: OrganizationRole) => boolean;
  canAccessOrganization: (orgId: Id<"organizations">) => boolean;

  // Type helpers
  isPersonalUser: () => boolean;
  isBusinessUser: () => boolean;
  isOwner: () => boolean;
  isAdmin: () => boolean;

  // Feature helpers
  canManageFinances: () => boolean;
  canManageSubscription: () => boolean;
  canManageMembers: () => boolean;
}
```

## Frontend (React 19 + TanStack Router + Vite)

### Imports & Setup
```typescript
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
```

### Permission-Based UI
```typescript
// Using auth context
const { hasPermission, member } = useAuth();

// Permission check
if (!hasPermission("documents:create")) {
  return <PermissionDenied />;
}

// Role-based rendering
if (member.role === "viewer") {
  return <ReadOnlyView />;
}
```

### Data Fetching
```typescript
// Query
const documents = useQuery(api.documents.list, { orgId });

// Mutation
const createDocument = useMutation(api.documents.create);
const handleCreate = () => {
  createDocument({ name: "New Doc", orgId });
};
```

### Route Structure (File-based routing)
```
src/routes/
├── __root.tsx          # Root layout with router setup
├── index.tsx           # Home page
├── $orgSlug/
│   ├── home.tsx        # Org-specific home
│   ├── documents.tsx   # Documents list
│   └── documents/
│       └── $docId.tsx  # Document detail
```

### Component Patterns
```typescript
// Shadcn + Tailwind v4
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  document: Doc<"documents">;
  onEdit: (id: Id<"documents">) => void;
}

export function DocumentCard({ document, onEdit }: DocumentCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{document.name}</h3>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onEdit(document._id)}
        className="mt-2"
      >
        Edit
      </Button>
    </div>
  );
}
```

## Testing

### Unit Tests (Vitest - Backend)
```typescript
// apps/backend/convex/myFunctions.test.ts
import { describe, it, expect, vi } from "vitest";
import { api } from "./_generated/api";

describe("myFunction", () => {
  it("should work", async () => {
    const mockCtx = { /* mock context */ };
    const result = await myFunction.handler(mockCtx, { arg: "value" });
    expect(result).toBeDefined();
  });
});
```

### E2E Tests (Playwright - Page Object Model)
```typescript
import { test, expect } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";

test.describe("Documents", () => {
  test("should create document", async ({ authenticatedPage, organizationSlug }) => {
    const page = new DocumentPage(authenticatedPage);
    await page.goto(organizationSlug);
    await page.createDocument("Test Document");

    await expect(authenticatedPage.locator('[data-testid="success"]')).toBeVisible();
  });
});
```

### Test Selectors (Priority Order)
1. `data-testid`: `page.getByTestId("document-title")`
2. Semantic: `page.getByRole("button", { name: "Save" })`
3. Label: `page.getByLabel("Email")`
4. **AVOID**: CSS classes, complex DOM paths

## Key Files & Architecture

| Purpose | Location |
|---------|----------|
| Auth wrappers | `apps/backend/convex/auth.ts` |
| Permission system | `apps/backend/convex/auth.utils.ts` |
| Database schemas | `apps/backend/convex/schema.ts` |
| Convex functions | `apps/backend/convex/**/*.ts` |
| React components | `apps/web/src/components/**/*.tsx` |
| UI primitives | `apps/web/src/components/ui/*.tsx` |
| Route definitions | `apps/web/src/routes/**/*.tsx` |
| E2E fixtures | `apps/web/e2e/fixtures/auth.ts` |
| Page objects | `apps/web/e2e/pages/**/*.ts` |
| Email templates | `packages/transactional/src/**/*.tsx` |
| TypeScript config | `tooling/typescript/base.json` |
| Biome config | `biome.jsonc` |

## Commits & Deployment

### Conventional Commits
```bash
feat: add document signing workflow
fix: resolve permission check bug
chore: update dependencies
docs: improve API documentation
refactor: simplify auth logic
```

### Pre-commit Checks
```bash
bun run static-analysis  # Run before commits
```

### Never Commit
- `.env*` files
- Secrets/credentials
- Generated files (except `convex/_generated/`)
- Build artifacts
- Test results

### Always Commit
- `apps/backend/convex/_generated/` (Convex generated files)
- Lockfiles (`bun.lockb`)
- Configuration files

## Development Workflow

### New Feature Development
1. Create todo list for multi-step tasks
2. Use auth wrappers for backend functions
3. Add permission checks in UI components
4. Write unit tests for backend logic
5. Add E2E tests for user flows
6. Run `bun run static-analysis` before commit

### Code Review Checklist
- [ ] TypeScript strict mode compliance
- [ ] Proper auth wrappers used
- [ ] Permission checks implemented
- [ ] Tests added/updated
- [ ] Biome formatting applied
- [ ] No console.logs in production code
- [ ] Error handling implemented

### Performance Considerations
- Use Convex indexes for queries
- Implement proper loading states
- Optimize bundle size
- Use React.memo for expensive components
- Implement proper pagination for large lists

This document is the source of truth for Seal development practices. Follow these guidelines to maintain code quality and consistency across the monorepo.
