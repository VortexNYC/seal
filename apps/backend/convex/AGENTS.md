# CONVEX BACKEND GUIDE

## OVERVIEW

Convex backend with domain-driven folders, strict auth wrappers, and schema-driven types.

## STRUCTURE

```
apps/backend/convex/
├── schema.ts            # Central schema export
├── auth.ts              # Auth barrel (errors + re-exports)
├── auth/wrappers.ts     # RLS auth/permission wrappers (canonical)
├── auth/permissions.ts  # Seal PERMISSIONS + ROLE_TEMPLATES; match/expand via @vortexnyc/permissions
├── auth/auth.permissions.ts # Unified getAuthContext
├── lib/canonicalGlue.ts # createVortexAuthGlue (identity)
├── lib/identity.ts      # findCurrentUserRow / requireViewer
├── auth.utils.ts        # Roles + permissions
├── http.ts              # HTTP routes + webhooks
├── api/                 # REST API (v1)
├── documents/           # Document workflows
├── organizations/       # Org management
├── vortex_billing/      # Billing integration
├── webhooks/            # Webhook endpoints/logs
└── _generated/          # Convex-generated types (commit)
```

## WHERE TO LOOK

| Task          | Location                            | Notes                               |
| ------------- | ----------------------------------- | ----------------------------------- |
| Auth wrappers | `apps/backend/convex/auth/wrappers.ts` (via `auth.ts`) | RLS + unified permissions; use for all queries/mutations |
| Permissions   | `apps/backend/convex/auth.utils.ts` | Role hierarchy + permission strings |
| Schemas       | `apps/backend/convex/schemas/`      | One table per file                  |
| REST API      | `apps/backend/convex/api/v1/`       | Public endpoints                    |
| Webhooks      | `apps/backend/convex/http.ts`       | Vortex Billing + auth HTTP router   |
| RLS rules     | `apps/backend/convex/rls.ts`        | Access control                      |
| Email transport | `apps/backend/convex/emails/resend_component.ts` | Seal Resend send seam; auth drafts via `sendAuthEmailDraft`. Core send blocked on **VOR-186**. |

## CONVENTIONS

- Use `authQuery`, `authMutation`, `memberMutation`, `adminMutation`, or `permissionMutation` wrappers.
- File names are snake_case; exported functions are camelCase.
- Permission strings follow `resource:action` (see `auth.utils.ts`).
- Commit `apps/backend/convex/_generated/` after schema changes.
- Auth/verify/invite HTML comes from `@vortexnyc/auth/convex` drafts; document templates stay in `@seal/transactional` (`@vortexnyc/email` render only until VOR-186).

## ANTI-PATTERNS

- Raw Convex `query`/`mutation` without wrappers.
- Modify `apps/backend/convex/schemas/subscription_coupons.ts` or `apps/backend/convex/schemas/subscription_promo_codes.ts` directly.
- Update usage accounting through the Vortex Billing projection path (preserve usage history).
- Edit `apps/backend/convex/_generated/*` manually.
- Hand-roll auth email HTML — use Core draft builders + `sendAuthEmailDraft`.

## See Also

- [Project knowledge base](../../AGENTS.md) — root conventions, commands, anti-patterns
- [Web app guide](../../web/AGENTS.md) — frontend routing, components, E2E tests
- [Landing/docs guide](../../landing/AGENTS.md) — marketing site, Fumadocs, API reference
- [Transactional email guide](../../../packages/transactional/AGENTS.md) — email templates and previews
- [VOR-186](https://linear.app/vortex-team/issue/VOR-186) — Core Resend/send transport (unblocks transport cutover)
