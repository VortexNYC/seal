# SPEC: VOR-161 — Workspace audit log API and UI

## Objective

Make the workspace audit log in Seal comprehensive and trustworthy. The `audit_logs` table, `GET /api/v1/organizations/:organizationSlug/audit` endpoint, and settings UI page already exist, but only a handful of actions emit audit events today. This work instruments the key document, recipient, template, settings, and token actions so admins have a complete, filterable, paginated log.

## Assumptions

1. The base branch for vortex-sign is `main` (no `staging` branch currently exists in the repo); previous Seal PRs have targeted `main`.
2. The existing `audit_logs` schema and `/audit` API are the contract; we extend usage rather than redesign.
3. PII means names, emails, phone numbers, SSNs, token secrets, and full signing URLs; safe metadata is IDs, slugs, public IDs, status values, and counts.
4. UI changes are limited to the existing `audit-log.tsx` settings page; a richer design is out of scope.

## Capability map

| Module                | Responsibility                                                                                 | Depends on                          |
| --------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| audit-api             | `GET /api/v1/organizations/:organizationSlug/audit` with filters and pagination                | schema, org middleware              |
| audit-instrumentation | Emit `writeAuditLog` calls from product routes                                                 | audit-api contract, `getAuditActor` |
| audit-ui              | Searchable, paginated log in `apps/web/src/routes/_authenticated/$slug/settings/audit-log.tsx` | audit-api client                    |

Build order: audit-api verification → instrumentation → UI polish → tests.

## Tech stack

- API: Hono + `@hono/zod-openapi`, Drizzle ORM, Cloudflare D1.
- Web: React 19 SPA, TanStack Router, TanStack Query, Cloudflare Kumo.
- Tests: Vitest (`@cloudflare/vitest-pool-workers`) for API; Playwright for web E2E if needed.

## Commands

```bash
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run check
pnpm test
pnpm --dir apps/api run test -- src/api/v1/audit-logs.test.ts
pnpm --dir apps/web run test
```

## Project structure

```
apps/api/src/
  global/schema.ts           # audit_logs table (exists)
  platform/audit-log.ts      # writeAuditLog, getAuditActor (exists)
  api/v1/audit-logs.ts       # GET /.../audit (exists, will be hardened)
  api/v1/documents.ts        # add missing document.* audit events
  api/v1/public.ts           # add recipient.* and document.completed audit events
  api/v1/recipients.ts       # add recipient.* audit events
  api/v1/templates.ts        # add template.* audit events
  api/v1/tokens.ts           # token events already partly done
  api/v1/audit-logs.test.ts  # new API tests

apps/web/src/
  lib/api-client.ts          # getAuditLogs (exists)
  routes/_authenticated/$slug/settings/audit-log.tsx  # wire pagination + filters
```

## Code style

- Use the existing `getAuditActor({ mcp, user, apiToken })` helper; never construct `AuditActor` inline.
- Use `writeAuditLog(db, { organizationId, actor, action, resourceType, resourceId, metadata })`.
- Action names are dot-namespaced: `document.sent`, `recipient.signed`, `template.created`, `settings.updated`.
- `resourceType` is a noun (`document`, `recipient`, `template`, `settings`, `api_token`).
- `metadata` contains only non-sensitive IDs, status values, or counts. No names, emails, secrets, or full URLs.
- Fire-and-forget audit writes with `.catch()` and a `console.error` so a failing audit row never fails the user action.

Example:

```typescript
const actor = getAuditActor({ mcp: c.get("mcp"), user: c.get("user") });
if (actor) {
  writeAuditLog(db, {
    organizationId,
    actor,
    action: "document.sent",
    resourceType: "document",
    resourceId: doc.id,
    metadata: { recipientCount: recipients.length },
  }).catch((err) => console.error("[audit] document.sent failed:", err));
}
```

## Testing strategy

- API unit tests in `apps/api/src/api/v1/audit-logs.test.ts`:
  - Filtering by `actor`, `action`, `resourceType`, `from`, `to`.
  - Pagination with `cursor`/`limit`.
  - Permission: non-admin token and non-admin membership get `403`.
  - Audit events are written from document create/send, recipient sign, template create, and token create.
- `webhook-events.test.ts` and existing suites continue to pass.
- Web: manual UI check for filter fields and load-more behavior; E2E only if a new critical user flow is added.

## Boundaries

- **Always do:**
  - Use `getAuditActor` for actor resolution.
  - Keep `metadata` free of PII.
  - Run `pnpm test` and `pnpm run typecheck` before committing.
  - Add audit events as a side effect; never block the primary action on audit write success.
- **Ask first:**
  - Adding new indexes or schema changes to `audit_logs`.
  - Changing the audit API response shape or auth model.
  - New dependencies.
- **Never do:**
  - Log PII or secrets in `metadata`.
  - Fail the user request if audit write fails.
  - Add AI attribution.

## Success criteria

- [ ] `GET /api/v1/organizations/:organizationSlug/audit` filters and paginates correctly.
- [ ] Audit events are written for document `create`, `view`, `send`, `sign`, `complete`, `void`, `decline`, `expire`.
- [ ] Audit events are written for recipient `added`, `viewed`, `signed`, `approved`, `declined`, `reminded`.
- [ ] Audit events are written for template `created`, `updated`, `used`.
- [ ] Audit events are written for settings changes (webhook, security, branding, signing) where those APIs are owned by Seal.
- [ ] Audit events are written for token `authenticated`, `create`, `revoke` (already partially done; verify and complete).
- [ ] UI exposes action and resource-type filters and a working "Load more" cursor.
- [ ] `actorType` is `user`, `agent`, or `api_token` for every event.
- [ ] No PII is stored in `metadata`.
- [ ] `vp lint`, `tsc`, and `vitest` pass.

## Open questions

1. Do we need a `settings.*` audit namespace now, or should settings changes be handled by a separate Core-owned API? The current settings routes live partly in `apps/web` using Core wrappers; we will only instrument Seal-owned API routes (`webhooks`, `tokens`, `signing` settings).
2. Does the audit page need a date-range filter UI, or is `from`/`to` query-only and excluded from the settings page for now?
3. Should failed/successful authentication attempts be audited? (Out of scope unless requested; focus on product actions.)
