# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack-based monorepo for Seal, a document signature and workflow management application. The project uses:
- **Frontend**: React 19 with TanStack Router (file-based routing), Vite, Tailwind CSS v4, Shadcn UI
- **Backend**: Convex (serverless backend-as-a-service)
- **Auth**: Clerk
- **Build System**: Turborepo with Bun
- **Linting/Formatting**: Biome

## Monorepo Structure

```
apps/
  web/          - Frontend React application
  backend/      - Convex backend with schemas, queries, mutations, actions
packages/
  transactional/ - React Email templates for transactional emails
tooling/
  typescript/   - Shared TypeScript configuration
scripts/
  linear/       - Custom Linear integration scripts (prefer these over MCP)
```

## Common Commands

### Development
```bash
# Install dependencies
bun install

# Run dev servers (from root)
bun --bun run start

# Run frontend dev server only
cd apps/web && bun --bun run dev

# Run backend (Convex) dev server only
cd apps/backend && bun --bun run dev
```

### Building
```bash
# Build all workspaces
bun --bun run build

# Build specific workspace
turbo run build --filter=@seal/web
```

### Testing
```bash
# Run E2E tests (Playwright)
cd apps/web && bun --bun run test:e2e

# Run E2E tests with UI
cd apps/web && bun --bun run test:e2e:ui

# Run E2E tests in headed mode
cd apps/web && bun --bun run test:e2e:headed

# Debug E2E tests
cd apps/web && bun --bun run test:e2e:debug

# Generate Playwright test code
cd apps/web && bun --bun run test:e2e:codegen
```

### Linting & Formatting
```bash
# Lint all workspaces
bun --bun run lint

# Format all workspaces
bun --bun run format

# Check all files with Biome
bun --bun run biome:check

# Auto-fix with Biome
bun --bun run biome:fix

# Type checking
bun --bun run typecheck
```

### Cleaning
```bash
# Clean root node_modules and caches
bun --bun run clean

# Clean all workspace node_modules
bun --bun run clean:workspaces
```

## Architecture

### Frontend (`apps/web`)

**Routing**: TanStack Router with file-based routing
- Routes are defined in `src/routes/`
- `__root.tsx` - Root layout with theme provider and toaster
- `_authenticated.tsx` - Protected routes layout (requires authentication)
- `_authenticated/$slug/` - Workspace-specific routes (settings, documents, templates)

**Key Integrations**:
- `src/integrations/convex/` - Convex client setup and query utilities
- `src/integrations/clerk/` - Clerk authentication components and utilities

**Components**:
- `src/components/ui/` - Shadcn UI components
- `src/components/documents/` - Document-specific components
- `src/components/team/` - Team management components
- `src/components/skeletons/` - Loading skeleton states

**State Management**: Uses TanStack Query with Convex integration (`@convex-dev/react-query`)

### Backend (`apps/backend/convex`)

**Structure**: Domain-driven organization with separation of concerns
- `schema.ts` - Main Convex schema definition (imports from `schemas/`)
- `schemas/` - Individual table schemas (documents, organizations, recipients, etc.)
- `auth/` - Authentication guards, permissions, and wrappers
- `documents/` - Document-related queries, mutations, and actions
- `organizations/` - Organization management logic
- `organization_roles/` - Role-based access control
- `stripe/` - Payment integration
- `validations/` - Zod validation schemas
- `webhooks.ts` - Webhook handlers (Clerk, Stripe)
- `http.ts` - HTTP endpoint definitions
- `crons.ts` - Scheduled job definitions

**Key Patterns**:
- **Queries**: Read-only data fetching
- **Mutations**: Data modifications
- **Actions**: External API calls, side effects (used for Resend emails, PDF generation, etc.)
- **Wrappers**: Permission-based access control wrappers in `auth/wrappers.ts`
- **Guards**: Helper functions for additional permission checks in `auth/guards.ts`
- **Helpers**: Shared utility functions per domain

**Permission-Based Wrappers** (use instead of raw `query`/`mutation`):
```typescript
// Basic authenticated (no permission check)
authQuery, authMutation

// Single permission required
permissionQuery("documents:view"), permissionMutation("documents:create")

// Multiple permissions (OR logic)
permissionAnyQuery(["documents:edit", "documents:delete"])

// Multiple permissions (AND logic)
permissionAllMutation(["documents:edit", "documents:share"])

// Role-based
adminQuery, adminMutation  // Admin or owner required
ownerQuery, ownerMutation  // Owner only
```

**Guard Functions** (for additional checks inside handlers):
```typescript
ensureOwner(auth)
ensureAdmin(auth)
ensureOrganizationScope(auth, targetOrgId)
ensurePermission(auth, "permission:name")
ensureResourceOwnerOrAdmin(auth, resourceOwnerId)
```

### Environment Variables

**Frontend** (`.env.local` in `apps/web`):
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `VITE_CONVEX_URL` - Convex deployment URL

**Backend** (`.env.local` in `apps/backend`):
- `CONVEX_DEPLOYMENT` - Convex deployment identifier
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_WEBHOOK_SECRET` - Clerk webhook signature verification

## Important Conventions

### Never infer type "any"
Always provide explicit types. Avoid using `any` type unless absolutely necessary.

### Convex `_generated` folder
Always commit the `apps/backend/convex/_generated` folder when working with Convex.

### Linear Integration
- Always check Linear for the team "Seal"
- If scripts are available in `scripts/linear/`, use them instead of the Linear MCP
- The `scripts/linear/linear-client.ts` provides a custom Linear API client with TypeScript types

### Adding UI Components
Use Shadcn CLI to add new components:
```bash
cd apps/web && pnpx shadcn@latest add button
```

### Route Creation
TanStack Router uses file-based routing. To add a route:
1. Create a new `.tsx` file in `apps/web/src/routes/`
2. TanStack Router automatically generates route configuration
3. Use `<Link to="/path">` for navigation

### Convex Schema Updates
When modifying Convex schemas:
1. Update schema files in `apps/backend/convex/schemas/`
2. Import and export types from `schema.ts`
3. Convex dev server will auto-regenerate types in `_generated/`
4. Commit the `_generated/` folder changes

### Authentication & Authorization
- Use Clerk for authentication
- Use Convex auth guards in `auth/guards.ts` for permission checking
- Organization-based access control via `organization_roles/`

### E2E Testing (`apps/web/e2e`)

Tests use Playwright with Page Object Model pattern:
- `e2e/tests/` - Test spec files
- `e2e/pages/` - Page object classes
- `e2e/fixtures/` - Test fixtures (auth, convex helpers)
- `e2e/utils/` - Test utilities and helpers

### Transactional Emails (`packages/transactional`)

React Email templates for:
- Document invitations, reminders, completion notifications
- Team invitations
- Welcome emails

## Key Technologies

- **Runtime**: Bun (package manager and runtime)
- **Build Tool**: Turbo (monorepo orchestration)
- **Frontend Framework**: React 19
- **Routing**: TanStack Router v1 (file-based)
- **Styling**: Tailwind CSS v4 with Shadcn UI
- **Backend**: Convex (serverless BaaS)
- **Auth**: Clerk
- **E2E Testing**: Playwright
- **Payments**: Stripe
- **Emails**: Resend with React Email
- **PDF**: pdf-lib for generation, pdfjs-dist for rendering
- **Code Quality**: Biome (linting + formatting)
