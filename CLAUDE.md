# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack-based monorepo for Seal, a document signature and workflow management application. The project uses:

- **Frontend**: React 19 with TanStack Router (file-based routing), Vite, Tailwind CSS v4, Shadcn UI
- **Backend**: Convex (serverless backend-as-a-service)
- **Auth**: Clerk
- **Build System**: Turborepo with Bun
- **Linting/Formatting**: oxlint + oxfmt

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
# Lint with oxlint
bun --bun run lint

# Auto-fix lint issues
bun --bun run lint:fix

# Format with oxfmt
bun --bun run format

# Check formatting without changes
bun --bun run format:check

# Run both lint and format check
bun --bun run check

# Auto-fix both lint and format
bun --bun run check:fix

# Type checking
bun --bun run typecheck

# Full static analysis (lint + format + typecheck + knip)
bun --bun run static-analysis
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
(authQuery, authMutation);

// Single permission required
(permissionQuery("documents:view"), permissionMutation("documents:create"));

// Multiple permissions (OR logic)
permissionAnyQuery(["documents:edit", "documents:delete"]);

// Multiple permissions (AND logic)
permissionAllMutation(["documents:edit", "documents:share"]);

// Role-based
(adminQuery, adminMutation); // Admin or owner required
(ownerQuery, ownerMutation); // Owner only
```

**Guard Functions** (for additional checks inside handlers):

```typescript
ensureOwner(auth);
ensureAdmin(auth);
ensureOrganizationScope(auth, targetOrgId);
ensurePermission(auth, "permission:name");
ensureResourceOwnerOrAdmin(auth, resourceOwnerId);
```

### Environment Variables

**Frontend** (`.env.local` in `apps/web`):

- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `VITE_CONVEX_URL` - Convex deployment URL

**Backend** (`.env.local` in `apps/backend`):

- `CONVEX_DEPLOYMENT` - Convex deployment identifier
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_WEBHOOK_SECRET` - Clerk webhook signature verification

### Test Account (Development)

When testing the app locally via Playwright or browser automation, use:

- **Email**: `shlomo@plasma.nyc`
- **Password**: `12345678`
- **Sign-in flow**: Email → "Use another method" → "Sign in with your password" → enter password
- **Note**: 2FA (email verification code) may be required for new devices. Check email for the 6-digit code or disable 2FA in the Clerk dev dashboard for automated testing.

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

## Public REST API (`apps/backend/convex/api/`)

The backend includes a public REST API infrastructure:

**Structure**:

- `api/index.ts` - API endpoint registration and routing
- `api/middleware.ts` - Clerk API key authentication and rate limiting
- `api/context.ts` - API context bridge (Clerk API key → internal user/org IDs)
- `api/errors.ts` - RFC 7807 standardized error responses
- `api/v1/` - Version 1 endpoints (documents, recipients, templates, signatures, webhooks)

**API Scopes** (configure in Clerk Dashboard):

```
seal:documents:read, seal:documents:write
seal:templates:read, seal:templates:write
seal:recipients:read, seal:recipients:write
seal:signatures:read
seal:webhooks:manage
```

**API Helpers**:

```typescript
// Create authenticated HTTP action
apiHttpAction(requiredScope, handler);

// Response helpers
apiResponse(200, { data: result });
apiError(404, "Resource not found", "RESOURCE_NOT_FOUND");
validationErrorResponse({ email: ["Invalid format"] });
```

See `docs/api-webhooks-v1-plan.md` for full API documentation.

## Document Workflow States

Documents follow a state machine:

```
draft → sent → in_progress → completed
                    ↓
                declined
     ↓
  cancelled
```

- **draft**: Document being prepared, can be edited
- **sent**: Sent to recipients, waiting for signatures
- **in_progress**: At least one signature collected
- **completed**: All required signatures collected
- **cancelled**: Sender voided the document
- **declined**: Recipient declined to sign

## Row-Level Security (RLS)

RLS is implemented in `apps/backend/convex/rls.ts`:

**Document Access Rules**:

- `private`: Only owner can access
- `workspace`: All org members can access (Pro plan)
- `specific`: Only explicitly granted users

**Access Control** (`auth/access_control.ts`):

```typescript
// Check document access level
const access = await getDocumentAccessLevel(ctx, document, userId, orgId);
// Returns: "none" | "view" | "edit" | "manage" | "owner"
```

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
- **PDF**: pdf-lib for generation, pdfjs-dist for rendering, @signpdf for digital signatures
- **Code Quality**: oxlint (linting) + oxfmt (formatting)
- **Validation**: Zod for schema validation
- **Webhooks**: Svix for webhook delivery

## Known Issues & Technical Debt

*Last reviewed: 2026-03-04*

### Open

*(none)*

### Resolved

- ~~**IP Address Tracking**: Hardcoded as "0.0.0.0"~~ — **Fixed**: `extractClientIp` utility in `http.ts` reads proxy headers; `/api/v1/ip` endpoint returns client IP; signing page fetches and passes IP through all mutations
- ~~**Per-Signature Hash Uses Weak Algorithm**~~ — **Fixed**: `generateStringHash` now uses SHA-256 via Web Crypto API (`crypto.subtle.digest`)
- ~~**Webhook HTTP Delivery Not Implemented**~~ — **Fixed**: Full delivery system in `webhooks/delivery.ts` with HMAC-SHA256 signing, exponential backoff retries, and cron-based processing
- ~~**Missing Email Triggers**~~ — **Fixed**: API `sendDocument` schedules `sendDocumentEmailsInternal`, `voidDocument` schedules `sendCancellationEmails`, `sendReminder` schedules `sendReminderEmailDirect`
- ~~**Recipient Token Security**~~ — **Fixed**: SHA-256 hashed tokens with `by_token_hash` index; `findRecipientByToken` does hash-based lookup with plaintext fallback for pre-migration records
- ~~**ESIGN Consent Flow**~~ — **Fixed**: `EsignConsentDialog` component gates signing page; `recordEsignConsent`/`recordEsignOptOut` mutations with audit trail
- ~~**Audit Trail Gaps**~~ — **Fixed**: `logRecipientAction` for signing/viewing/declining; audit logging on `submitRecipientSignature`, `submitSignatureAuthenticated`, `createDocument`, `markDocumentAsSent`; recipient CRUD audit logging
- ~~**Checkbox Fields**~~ — **Fixed**: Multi-option rendering with JSON array storage in `CheckboxFieldInput`
- ~~**File Upload Fields**~~ — **Fixed**: Convex Storage upload via `generateAttachmentUploadUrl` mutation; stores `storageId` instead of base64
- ~~**Sentry Integration**~~ — **Fixed**: `Sentry.captureException` called in `ErrorBoundary.componentDidCatch`
- ~~**Rate Limiting**~~ — **Fixed**: Sliding window rate limiter in `api/rate_limit.ts` with DB-backed counters and hourly cleanup cron
- ~~**Document Detail Page Complexity**~~ — **Fixed**: Extracted `useSectionState`, `useDocumentState`, `usePdfViewer`, `useFieldPlacement` hooks plus `DocumentSidebar` component; route file reduced significantly
- ~~**Field List Virtualization**~~ — **Fixed**: `field-list.tsx` uses `@tanstack/react-virtual` with threshold at 20 items; `overscan: 5`, `gap: 8`, dynamic row height measurement via `measureElement`
- ~~**Form Validation**~~ — **Fixed**: Zod validation with `@hookform/resolvers` integrated into recipient, send, contact, and member invite forms
- ~~**Pro Plan Error Messages Expose Stack Traces**~~ — **Fixed**: `parseConvexError` in `utils.ts` now extracts the user-facing message from Convex error strings; `save-as-template-dialog.tsx` uses `getErrorMessage()` consistently

## Component Guidelines

### Large Component Refactoring

When working on `$documentId.tsx` or similar large components:

- Consider extracting state into custom hooks (`useDocumentFields`, `useRecipients`, etc.)
- Use `useReducer` for related state (field properties, pending changes)
- Extract dialog components with their own state management

### State Management Patterns

```typescript
// Good: Use custom hooks for complex state
const { fields, addField, removeField } = useDocumentFields(documentId);

// Good: Group related state with useReducer
const [fieldState, dispatch] = useReducer(fieldReducer, initialState);

// Avoid: Multiple related useState calls
const [fieldName, setFieldName] = useState("");
const [fieldType, setFieldType] = useState("");
const [fieldOptions, setFieldOptions] = useState([]);
```

### Performance Optimization

- Memoize callbacks passed to child components with `useCallback`
- Use `useMemo` for expensive computations
- Consider virtualization for lists > 50 items (use `@tanstack/react-virtual`)

## Security Considerations

### API Keys

- Clerk API keys are used for programmatic access
- Keys are scoped to specific operations (configured in Clerk Dashboard)
- Key prefix is stored for display, but full key is only shown once at creation

### Recipient Tokens

- Tokens grant signing access without authentication
- Always validate token ownership and expiration
- Rate limit token validation attempts to prevent brute force

### Webhook Security

- Clerk webhooks verified with Svix signatures
- User-configured webhooks use HMAC-SHA256 signatures
- Always verify webhook signatures before processing
