# Fumadocs Developer Portal

## Context

### Original Request

Create comprehensive developer documentation for Seal's API, Webhooks, and MCP server using Fumadocs in the apps/web/ directory.

### Interview Summary

**Key Discussions**:

- **Scope**: Full Developer Portal (API Reference + Guides + MCP Integration + Webhook Setup)
- **Interactivity**: Static MDX docs only (no playground, no OpenAPI UI)
- **Access**: Public at /docs (no authentication required)
- **Audience**: External developers integrating with Seal's API
- **Code Examples**: TypeScript + cURL
- **Structure**: By Feature (Getting Started > API Reference > Webhooks > MCP Integration)
- **QA Strategy**: Manual verification (visual browser checks + build verification)

**Research Findings**:

- **API v1**: 30+ REST endpoints across 6 modules (Documents, Recipients, Templates, Signatures, Webhooks, Uploads)
- **Authentication**: Clerk-based API keys (ak_xxx) with scope-based access control
- **Webhooks**: 17 outbound event types (document._, recipient._, template.\*) + HMAC-SHA256 signatures
- **MCP Server**: 25 tools + 4 resources, Clerk OAuth auth, deployed at mcp.seal.nyc
- **React Version**: 19.2.3 (meets Fumadocs requirement of ≥19.2.0)
- **Fumadocs**: Official Vite + TanStack Router support with rich MDX components

### Metis Review

**Identified Gaps** (addressed):

- React version validation → VERIFIED: 19.2.3 meets requirements
- Vite config requirements → Added task for resolve.noExternal
- Provider selection → Must use `fumadocs-ui/provider/tanstack`
- Scope creep risks → Explicit "Must NOT Have" section added
- Acceptance criteria → Comprehensive checklist added

---

## Work Objectives

### Core Objective

Create a public developer documentation portal at /docs using Fumadocs, covering API reference, webhooks, and MCP integration for external developers.

### Concrete Deliverables

- Fumadocs infrastructure in apps/web (Vite plugin, TanStack Router routes, Tailwind config)
- Content directory structure at apps/web/content/docs/
- Getting Started documentation (auth, quick start)
- API Reference documentation (all v1 endpoints)
- Webhooks documentation (events, setup, verification)
- MCP Integration documentation (tools, resources, auth)

### Definition of Done

- [x] /docs loads without authentication
- [x] All navigation links work (no 404s)
- [x] Code examples are syntax-highlighted
- [x] Mobile responsive layout
- [x] `bun run build` succeeds with no errors
- [x] `bun run typecheck` passes

### Must Have

- Public /docs route (no auth required)
- Getting Started with authentication guide
- Complete API v1 endpoint documentation
- All 17 webhook event types documented
- MCP tool reference table
- TypeScript + cURL examples for all endpoints
- Fumadocs built-in search

### Must NOT Have (Guardrails)

- Interactive API playground
- OpenAPI/Swagger UI generation
- Code examples in Python, Go, Ruby, etc. (TypeScript + cURL only)
- Custom MDX components beyond Fumadocs built-ins
- External search (Algolia, etc.)
- SDK generation
- Internationalization (i18n)
- Documentation versioning
- Internal Convex mutation documentation
- Stripe webhook handler documentation (internal only)
- `fumadocs-next` package (it's for Next.js only)

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (Playwright E2E in apps/web/e2e/)
- **User wants tests**: Manual verification only
- **Framework**: N/A (manual QA for documentation)

### Manual QA Procedures

Each task includes manual verification:

**For Infrastructure Tasks:**

- Verify `bun run dev` starts without errors
- Navigate to /docs in browser
- Check console for errors

**For Content Tasks:**

- Navigate to the new page in browser
- Verify rendering (headings, code blocks, links)
- Test code example copy-to-clipboard
- Check mobile responsiveness (resize browser)

---

## Task Flow

```
0. Pre-flight Verification
         ↓
1. Install Dependencies
         ↓
2. Configure Vite Plugin
         ↓
3. Configure Source Loader
         ↓
4. Configure Tailwind
         ↓
5. Create TanStack Router Routes
         ↓
6. Create Content Directory Structure ← SMOKE TEST
         ↓
7-10. Content: Getting Started (parallel)
         ↓
11-16. Content: API Reference (parallel)
         ↓
17-19. Content: Webhooks (parallel)
         ↓
20-22. Content: MCP Integration (parallel)
         ↓
23. Final Verification
```

## Parallelization

| Group | Tasks                  | Reason                            |
| ----- | ---------------------- | --------------------------------- |
| A     | 7, 8, 9, 10            | Independent Getting Started pages |
| B     | 11, 12, 13, 14, 15, 16 | Independent API Reference pages   |
| C     | 17, 18, 19             | Independent Webhook pages         |
| D     | 20, 21, 22             | Independent MCP pages             |

| Task | Depends On | Reason                               |
| ---- | ---------- | ------------------------------------ |
| 1    | 0          | Dependencies need pre-flight check   |
| 2-5  | 1          | Configuration needs dependencies     |
| 6    | 5          | Content needs routes                 |
| 7-10 | 6          | Pages need directory structure       |
| 23   | 22         | Final verification needs all content |

---

## TODOs

### Phase 1: Infrastructure

- [x] 0. Pre-flight Verification

  **What to do**:
  - Verify React version is 19.2.3+ in workspace catalog
  - Verify no existing /docs route conflicts
  - Check Vite version compatibility

  **Must NOT do**:
  - Modify React version

  **Parallelizable**: NO (must be first)

  **References**:
  - `package.json:catalog` - Workspace catalog definitions
  - `apps/web/src/routes/` - Existing routes to check for conflicts

  **Acceptance Criteria**:
  - [ ] Confirm React ≥19.2.0: `grep "react" bun.lock | head -5` → shows ^19.2.3
  - [ ] Confirm no /docs route: `ls apps/web/src/routes/` → no `docs` directory

  **Commit**: NO (verification only)

---

- [x] 1. Install Fumadocs Dependencies

  **What to do**:
  - Install `fumadocs-mdx`, `fumadocs-core`, `fumadocs-ui`
  - Install `@types/mdx` as dev dependency
  - Install `vite-tsconfig-paths` if not present

  **Must NOT do**:
  - Install `fumadocs-next` (Next.js only)
  - Install `fumadocs-openapi` (not needed for static docs)

  **Parallelizable**: NO (depends on 0)

  **References**:
  - `apps/web/package.json` - Current dependencies
  - Fumadocs docs: https://fumadocs.dev/docs/getting-started/installation

  **Acceptance Criteria**:
  - [ ] Command: `cd apps/web && bun add fumadocs-mdx fumadocs-core fumadocs-ui && bun add -D @types/mdx`
  - [ ] Verify: `grep fumadocs apps/web/package.json` → shows all three packages
  - [ ] Build check: `bunx turbo run build --filter=@seal/web` → succeeds

  **Commit**: YES
  - Message: `feat(web): add fumadocs dependencies for developer portal`
  - Files: `apps/web/package.json`, `bun.lock`

---

- [x] 2. Configure Vite Plugin for Fumadocs

  **What to do**:
  - Add fumadocs-mdx/vite plugin to vite.config.ts
  - Add `resolve.noExternal` for fumadocs packages (prevents React context issues)
  - Import source config

  **Must NOT do**:
  - Remove existing plugins
  - Change existing Vite configuration unnecessarily

  **Parallelizable**: NO (depends on 1)

  **References**:
  - `apps/web/vite.config.ts` - Current Vite configuration
  - Pattern: Follow existing plugin ordering in vite.config.ts
  - Fumadocs Vite docs: https://fumadocs.dev/docs/getting-started/vite

  **Acceptance Criteria**:
  - [ ] vite.config.ts includes `mdx()` plugin import from `fumadocs-mdx/vite`
  - [ ] vite.config.ts includes `resolve.noExternal: ['fumadocs-core', 'fumadocs-ui']`
  - [ ] Build check: `bunx turbo run build --filter=@seal/web` → succeeds
  - [ ] Dev check: `bunx turbo run dev --filter=@seal/web` → starts without errors

  **Commit**: YES
  - Message: `feat(web): configure vite plugin for fumadocs mdx`
  - Files: `apps/web/vite.config.ts`

---

- [x] 3. Create Source Configuration

  **What to do**:
  - Create `apps/web/source.config.ts` with docs collection
  - Configure content directory path as `content/docs`
  - Create `apps/web/src/lib/source.ts` for source loader

  **Must NOT do**:
  - Add i18n configuration
  - Add versioning configuration

  **Parallelizable**: NO (depends on 2)

  **References**:
  - Fumadocs source config: https://fumadocs.dev/docs/getting-started/configuration
  - `apps/web/src/lib/` - Existing lib directory structure

  **Acceptance Criteria**:
  - [ ] File exists: `apps/web/source.config.ts`
  - [ ] File exists: `apps/web/src/lib/source.ts`
  - [ ] TypeScript check: `bunx turbo run typecheck --filter=@seal/web` → passes

  **Commit**: YES
  - Message: `feat(web): add fumadocs source configuration`
  - Files: `apps/web/source.config.ts`, `apps/web/src/lib/source.ts`

---

- [x] 4. Configure Tailwind for Fumadocs

  **What to do**:
  - Add fumadocs-ui to Tailwind content paths
  - Import fumadocs-ui/style.css in appropriate location
  - Verify Tailwind v4 compatibility

  **Must NOT do**:
  - Override existing Tailwind configuration
  - Add custom theme colors beyond brand

  **Parallelizable**: NO (depends on 3)

  **References**:
  - `apps/web/src/styles.css` - Current styles entry point
  - Fumadocs Tailwind: https://fumadocs.dev/docs/ui/styling

  **Acceptance Criteria**:
  - [ ] fumadocs-ui styles imported in styles.css or layout
  - [ ] Build check: `bunx turbo run build --filter=@seal/web` → succeeds
  - [ ] Dev check: No Tailwind class conflicts in console

  **Commit**: YES
  - Message: `feat(web): configure tailwind for fumadocs styles`
  - Files: `apps/web/src/styles.css` or relevant style file

---

- [x] 5. Create TanStack Router Routes for Docs

  **What to do**:
  - Create `apps/web/src/routes/docs/$.tsx` (catch-all route for docs)
  - Create `apps/web/src/routes/docs.tsx` (layout route)
  - Use `fumadocs-ui/provider/tanstack` provider (NOT Next.js provider)
  - Configure DocsLayout with navigation

  **Must NOT do**:
  - Add authentication to docs routes
  - Use `fumadocs-ui/provider` (Next.js default)
  - Edit routeTree.gen.ts (auto-generated)

  **Parallelizable**: NO (depends on 4)

  **References**:
  - `apps/web/src/routes/index.tsx` - Pattern for public routes
  - `apps/web/src/routes/__root.tsx` - Root layout pattern
  - Fumadocs TanStack Router: https://fumadocs.dev/docs/getting-started/tanstack-router

  **Acceptance Criteria**:
  - [ ] File exists: `apps/web/src/routes/docs/$.tsx`
  - [ ] Route uses DocsLayout from fumadocs-ui
  - [ ] Navigate to http://localhost:5173/docs → shows empty docs layout (no 404)
  - [ ] TypeScript check: `bunx turbo run typecheck --filter=@seal/web` → passes

  **Commit**: YES
  - Message: `feat(web): add tanstack router routes for docs`
  - Files: `apps/web/src/routes/docs/$.tsx`, `apps/web/src/routes/docs.tsx`

---

- [x] 6. Create Content Directory Structure + Smoke Test

  **What to do**:
  - Create `apps/web/content/docs/` directory
  - Create `apps/web/content/docs/index.mdx` (docs homepage)
  - Create `apps/web/content/docs/meta.json` (sidebar configuration)
  - Verify /docs renders the index page (SMOKE TEST)

  **Must NOT do**:
  - Create all content pages yet (just structure)

  **Parallelizable**: NO (depends on 5)

  **References**:
  - Fumadocs content structure: https://fumadocs.dev/docs/getting-started/file-structure

  **Acceptance Criteria**:
  - [ ] Directory exists: `apps/web/content/docs/`
  - [ ] File exists: `apps/web/content/docs/index.mdx` with title "Developer Documentation"
  - [ ] File exists: `apps/web/content/docs/meta.json` with sidebar structure
  - [ ] **SMOKE TEST**: Navigate to http://localhost:5173/docs → shows "Developer Documentation" heading
  - [ ] Sidebar navigation renders without errors

  **Commit**: YES
  - Message: `feat(web): add docs content directory structure and homepage`
  - Files: `apps/web/content/docs/index.mdx`, `apps/web/content/docs/meta.json`

---

### Phase 2: Getting Started Content

- [x] 7. Create Getting Started Index Page

  **What to do**:
  - Create `apps/web/content/docs/getting-started/index.mdx`
  - Overview of Seal API capabilities
  - Quick links to auth, endpoints, webhooks, MCP
  - Create `apps/web/content/docs/getting-started/meta.json`

  **Must NOT do**:
  - Include implementation details
  - Link to internal documentation

  **Parallelizable**: YES (with 8, 9, 10)

  **References**:
  - `apps/backend/convex/api/v1/` - API capabilities overview

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/getting-started → renders introduction
  - [ ] All internal links work (no 404s)
  - [ ] MDX renders without console errors

  **Commit**: NO (groups with Phase 2)

---

- [x] 8. Create Authentication Guide

  **What to do**:
  - Create `apps/web/content/docs/getting-started/authentication.mdx`
  - Document API key creation process (Clerk dashboard)
  - Document scope-based access control
  - Include TypeScript + cURL examples for authenticated requests
  - Document all available scopes

  **Must NOT do**:
  - Document internal Clerk configuration
  - Include Clerk admin credentials

  **Parallelizable**: YES (with 7, 9, 10)

  **References**:
  - `apps/backend/convex/api/context.ts` - Scope definitions
  - `apps/backend/convex/api/middleware.ts` - Auth middleware patterns
  - Scopes: seal:documents:read/write, seal:templates:read/write, seal:recipients:read/write, seal:signatures:read, seal:webhooks:manage

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/getting-started/authentication → renders auth guide
  - [ ] All scopes documented in a table
  - [ ] TypeScript example: `const response = await fetch(..., { headers: { Authorization: 'Bearer ak_xxx' } })`
  - [ ] cURL example: `curl -H "Authorization: Bearer ak_xxx" https://api.seal.nyc/...`
  - [ ] Code blocks have syntax highlighting

  **Commit**: NO (groups with Phase 2)

---

- [x] 9. Create Quick Start Guide

  **What to do**:
  - Create `apps/web/content/docs/getting-started/quick-start.mdx`
  - Step-by-step: Create API key → Upload document → Add recipients → Send for signing
  - Include complete TypeScript + cURL examples for each step
  - Link to detailed API reference sections

  **Must NOT do**:
  - Document every endpoint option
  - Include Python/Go/Ruby examples

  **Parallelizable**: YES (with 7, 8, 10)

  **References**:
  - `apps/backend/convex/api/v1/documents.ts` - Document creation flow
  - `apps/backend/convex/api/v1/recipients.ts` - Recipient management
  - `apps/backend/convex/api/v1/uploads.ts` - File upload flow

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/getting-started/quick-start → renders quick start
  - [ ] 4-step flow clearly documented
  - [ ] Each step has working TypeScript + cURL examples
  - [ ] Response examples show expected output

  **Commit**: NO (groups with Phase 2)

---

- [x] 10. Create Error Handling Guide

  **What to do**:
  - Create `apps/web/content/docs/getting-started/error-handling.mdx`
  - Document error response format (RFC 7807)
  - List common error codes and their meanings
  - Include error handling code examples

  **Must NOT do**:
  - Document every possible error
  - Include internal error codes

  **Parallelizable**: YES (with 7, 8, 9)

  **References**:
  - `apps/backend/convex/api/middleware.ts` - Error response format

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/getting-started/error-handling → renders error guide
  - [ ] Error response JSON schema documented
  - [ ] Common errors table (400, 401, 403, 404, 429, 500)
  - [ ] TypeScript error handling example

  **Commit**: YES (all Phase 2)
  - Message: `docs(web): add getting started documentation`
  - Files: All files in `apps/web/content/docs/getting-started/`

---

### Phase 3: API Reference Content

- [x] 11. Create API Reference Index Page

  **What to do**:
  - Create `apps/web/content/docs/api-reference/index.mdx`
  - Overview of all API endpoints
  - Base URL documentation (https://seal.convex.site/api/v1)
  - Create `apps/web/content/docs/api-reference/meta.json`

  **Must NOT do**:
  - Include endpoint details (separate pages)

  **Parallelizable**: YES (with 12-16)

  **References**:
  - `apps/backend/convex/http.ts` - HTTP route definitions

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/api-reference → renders API overview
  - [ ] Base URL clearly documented
  - [ ] Links to all resource sections work

  **Commit**: NO (groups with Phase 3)

---

- [x] 12. Create Documents API Reference

  **What to do**:
  - Create `apps/web/content/docs/api-reference/documents.mdx`
  - Document all 8 document endpoints with:
    - HTTP method and path
    - Required scope
    - Request parameters/body schema
    - Response schema
    - TypeScript + cURL examples

  **Must NOT do**:
  - Include internal Convex implementation details

  **Parallelizable**: YES (with 11, 13-16)

  **References**:
  - `apps/backend/convex/api/v1/documents.ts` - Document endpoints
  - Endpoints: list, get, create, update, delete, send, void, download

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/api-reference/documents → renders documents API
  - [ ] All 8 endpoints documented
  - [ ] Each endpoint has method, path, scope, parameters, response
  - [ ] TypeScript + cURL examples for each endpoint

  **Commit**: NO (groups with Phase 3)

---

- [x] 13. Create Recipients API Reference

  **What to do**:
  - Create `apps/web/content/docs/api-reference/recipients.mdx`
  - Document all 6 recipient endpoints
  - Document recipient roles (signer, approver, viewer)
  - Include TypeScript + cURL examples

  **Must NOT do**:
  - Document internal recipient state transitions

  **Parallelizable**: YES (with 11, 12, 14-16)

  **References**:
  - `apps/backend/convex/api/v1/recipients.ts` - Recipient endpoints
  - Endpoints: list, get, add, update, remove, remind

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/api-reference/recipients → renders recipients API
  - [ ] All 6 endpoints documented
  - [ ] Recipient roles table included
  - [ ] TypeScript + cURL examples for each endpoint

  **Commit**: NO (groups with Phase 3)

---

- [x] 14. Create Templates API Reference

  **What to do**:
  - Create `apps/web/content/docs/api-reference/templates.mdx`
  - Document all 7 template endpoints
  - Document template field types
  - Include TypeScript + cURL examples

  **Must NOT do**:
  - Document internal template rendering

  **Parallelizable**: YES (with 11-13, 15, 16)

  **References**:
  - `apps/backend/convex/api/v1/templates.ts` - Template endpoints
  - Endpoints: list, get, create, update, delete, use, get_fields

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/api-reference/templates → renders templates API
  - [ ] All 7 endpoints documented
  - [ ] Field types table included
  - [ ] TypeScript + cURL examples for each endpoint

  **Commit**: NO (groups with Phase 3)

---

- [x] 15. Create Signatures API Reference

  **What to do**:
  - Create `apps/web/content/docs/api-reference/signatures.mdx`
  - Document all 4 signature endpoints
  - Document signature verification process
  - Document audit trail structure
  - Include TypeScript + cURL examples

  **Must NOT do**:
  - Document internal signature storage

  **Parallelizable**: YES (with 11-14, 16)

  **References**:
  - `apps/backend/convex/api/v1/signatures.ts` - Signature endpoints
  - Endpoints: list, get, verify, audit

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/api-reference/signatures → renders signatures API
  - [ ] All 4 endpoints documented
  - [ ] Verification response schema documented
  - [ ] Audit trail event types documented
  - [ ] TypeScript + cURL examples for each endpoint

  **Commit**: NO (groups with Phase 3)

---

- [x] 16. Create Uploads API Reference

  **What to do**:
  - Create `apps/web/content/docs/api-reference/uploads.mdx`
  - Document upload URL generation endpoint
  - Document direct upload flow to storage
  - Include TypeScript + cURL examples for complete flow

  **Must NOT do**:
  - Document internal storage implementation

  **Parallelizable**: YES (with 11-15)

  **References**:
  - `apps/backend/convex/api/v1/uploads.ts` - Upload endpoint

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/api-reference/uploads → renders uploads API
  - [ ] Upload flow diagram/steps documented
  - [ ] TypeScript example with fetch upload
  - [ ] cURL example with file upload

  **Commit**: YES (all Phase 3)
  - Message: `docs(web): add api reference documentation`
  - Files: All files in `apps/web/content/docs/api-reference/`

---

### Phase 4: Webhooks Content

- [x] 17. Create Webhooks Index Page

  **What to do**:
  - Create `apps/web/content/docs/webhooks/index.mdx`
  - Overview of webhook system
  - List all 17 event types with descriptions
  - Create `apps/web/content/docs/webhooks/meta.json`

  **Must NOT do**:
  - Document internal webhook delivery implementation
  - Document Stripe/Clerk inbound webhooks

  **Parallelizable**: YES (with 18, 19)

  **References**:
  - `apps/backend/convex/schemas/webhooks.ts` - WEBHOOK_EVENT_TYPES
  - Events: document.created/sent/viewed/completed/voided/expired/declined, recipient.added/viewed/signed/approved/declined/reminded, template.created/updated/used

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/webhooks → renders webhooks overview
  - [ ] All 17 event types listed with descriptions
  - [ ] Event type table has category grouping

  **Commit**: NO (groups with Phase 4)

---

- [x] 18. Create Webhook Setup Guide

  **What to do**:
  - Create `apps/web/content/docs/webhooks/setup.mdx`
  - Document webhook endpoint creation via API
  - Document webhook configuration options (events, URL, etc.)
  - Document webhook status states (active, paused, disabled)
  - Include TypeScript + cURL examples

  **Must NOT do**:
  - Document UI-based webhook creation (that's user docs, not developer docs)

  **Parallelizable**: YES (with 17, 19)

  **References**:
  - `apps/backend/convex/api/v1/webhooks.ts` - Webhook management endpoints
  - Endpoints: list, get, create, update, delete, rotate-secret

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/webhooks/setup → renders setup guide
  - [ ] Webhook creation example with all options
  - [ ] Secret rotation documented
  - [ ] Status states explained

  **Commit**: NO (groups with Phase 4)

---

- [x] 19. Create Webhook Signature Verification Guide

  **What to do**:
  - Create `apps/web/content/docs/webhooks/verification.mdx`
  - Document HMAC-SHA256 signature verification
  - Document webhook payload structure
  - Include complete TypeScript verification example
  - Link to generic HMAC-SHA256 docs for other languages

  **Must NOT do**:
  - Include verification examples in Python, Go, Ruby, etc.

  **Parallelizable**: YES (with 17, 18)

  **References**:
  - `apps/backend/convex/webhooks/mutations.ts` - hashSecret function pattern
  - Webhook payload includes: event_type, timestamp, data, signature

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/webhooks/verification → renders verification guide
  - [ ] HMAC-SHA256 algorithm documented
  - [ ] Complete TypeScript verification function
  - [ ] Example webhook payload shown
  - [ ] Security best practices noted (timing-safe comparison)

  **Commit**: YES (all Phase 4)
  - Message: `docs(web): add webhooks documentation`
  - Files: All files in `apps/web/content/docs/webhooks/`

---

### Phase 5: MCP Integration Content

- [x] 20. Create MCP Integration Index Page

  **What to do**:
  - Create `apps/web/content/docs/mcp/index.mdx`
  - Overview of MCP server capabilities
  - MCP server URL (mcp.seal.nyc)
  - Create `apps/web/content/docs/mcp/meta.json`

  **Must NOT do**:
  - Include MCP protocol tutorial (link to official MCP docs)

  **Parallelizable**: YES (with 21, 22)

  **References**:
  - `apps/mcp-server/src/index.ts` - Server configuration
  - `.mcp.json` - MCP server configuration

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/mcp → renders MCP overview
  - [ ] Server URL documented
  - [ ] Links to tools and resources sections work

  **Commit**: NO (groups with Phase 5)

---

- [x] 21. Create MCP Tools Reference

  **What to do**:
  - Create `apps/web/content/docs/mcp/tools.mdx`
  - Document all 25 MCP tools in a reference table
  - Group by category (Documents, Templates, Recipients, Signatures, Uploads)
  - Include tool parameters and return types

  **Must NOT do**:
  - Include full MCP protocol tutorial

  **Parallelizable**: YES (with 20, 22)

  **References**:
  - `apps/mcp-server/src/tools/documents.ts` - Document tools
  - `apps/mcp-server/src/tools/templates.ts` - Template tools
  - `apps/mcp-server/src/tools/recipients.ts` - Recipient tools
  - `apps/mcp-server/src/tools/signatures.ts` - Signature tools
  - `apps/mcp-server/src/tools/uploads.ts` - Upload tools

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/mcp/tools → renders tools reference
  - [ ] All 25 tools documented
  - [ ] Tools grouped by category
  - [ ] Parameters and return types for each tool

  **Commit**: NO (groups with Phase 5)

---

- [x] 22. Create MCP Authentication Guide

  **What to do**:
  - Create `apps/web/content/docs/mcp/authentication.mdx`
  - Document Clerk OAuth flow for MCP
  - Document API key fallback for stdio mode
  - Include Claude Desktop configuration example

  **Must NOT do**:
  - Document internal MCP server implementation

  **Parallelizable**: YES (with 20, 21)

  **References**:
  - `apps/mcp-server/src/index.ts` - Auth flow
  - `apps/mcp-server/src/utils/auth.ts` - Token extraction
  - OAuth endpoints: /.well-known/oauth-protected-resource/mcp, /.well-known/oauth-authorization-server

  **Acceptance Criteria**:
  - [ ] Navigate to /docs/mcp/authentication → renders auth guide
  - [ ] OAuth flow documented
  - [ ] API key usage documented
  - [ ] Claude Desktop config example shown

  **Commit**: YES (all Phase 5)
  - Message: `docs(web): add mcp integration documentation`
  - Files: All files in `apps/web/content/docs/mcp/`

---

### Phase 6: Final Verification

- [x] 23. Final Verification and Polish

  **What to do**:
  - Verify all internal links work (no 404s)
  - Verify all code examples have syntax highlighting
  - Test mobile responsiveness
  - Run full build and typecheck
  - Verify search functionality works

  **Must NOT do**:
  - Add new features
  - Expand scope

  **Parallelizable**: NO (final task)

  **References**:
  - All created documentation files

  **Acceptance Criteria**:
  - [ ] Navigate through all pages - no 404s
  - [ ] All code blocks have syntax highlighting
  - [ ] Mobile viewport (375px) - no horizontal scroll
  - [ ] `bunx turbo run build --filter=@seal/web` → succeeds
  - [ ] `bunx turbo run typecheck --filter=@seal/web` → passes
  - [ ] Search: Type "documents" → shows relevant results

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message                                                        | Files                               | Verification |
| ---------- | -------------------------------------------------------------- | ----------------------------------- | ------------ |
| 1          | `feat(web): add fumadocs dependencies for developer portal`    | package.json, bun.lock              | build        |
| 2          | `feat(web): configure vite plugin for fumadocs mdx`            | vite.config.ts                      | build        |
| 3          | `feat(web): add fumadocs source configuration`                 | source.config.ts, src/lib/source.ts | typecheck    |
| 4          | `feat(web): configure tailwind for fumadocs styles`            | styles.css                          | build        |
| 5          | `feat(web): add tanstack router routes for docs`               | src/routes/docs/\*.tsx              | typecheck    |
| 6          | `feat(web): add docs content directory structure and homepage` | content/docs/\*                     | manual       |
| 10         | `docs(web): add getting started documentation`                 | content/docs/getting-started/\*     | manual       |
| 16         | `docs(web): add api reference documentation`                   | content/docs/api-reference/\*       | manual       |
| 19         | `docs(web): add webhooks documentation`                        | content/docs/webhooks/\*            | manual       |
| 22         | `docs(web): add mcp integration documentation`                 | content/docs/mcp/\*                 | manual       |

---

## Success Criteria

### Verification Commands

```bash
# Build verification
bunx turbo run build --filter=@seal/web

# Type check
bunx turbo run typecheck --filter=@seal/web

# Dev server
bunx turbo run dev --filter=@seal/web
# Then navigate to http://localhost:5173/docs
```

### Final Checklist

- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] /docs publicly accessible without auth
- [x] All 30+ API endpoints documented
- [x] All 17 webhook events documented
- [x] All 25 MCP tools documented
- [x] TypeScript + cURL examples throughout
- [x] Mobile responsive
- [x] Build passes
- [x] No TypeScript errors
