# CONVEX BACKEND GUIDE

## OVERVIEW

Convex backend with domain-driven folders, strict auth wrappers, and schema-driven types.

## STRUCTURE

```
apps/backend/convex/
├── schema.ts            # Central schema export
├── auth.ts              # Wrapper definitions
├── auth.utils.ts        # Roles + permissions
├── http.ts              # HTTP routes + webhooks
├── api/                 # REST API (v1)
├── documents/           # Document workflows
├── organizations/       # Org management
├── stripe/              # Billing integration
├── webhooks/            # Webhook endpoints/logs
└── _generated/          # Convex-generated types (commit)
```

## WHERE TO LOOK

| Task          | Location                            | Notes                               |
| ------------- | ----------------------------------- | ----------------------------------- |
| Auth wrappers | `apps/backend/convex/auth.ts`       | Use for all queries/mutations       |
| Permissions   | `apps/backend/convex/auth.utils.ts` | Role hierarchy + permission strings |
| Schemas       | `apps/backend/convex/schemas/`      | One table per file                  |
| REST API      | `apps/backend/convex/api/v1/`       | Public endpoints                    |
| Webhooks      | `apps/backend/convex/http.ts`       | Clerk + Stripe HTTP router          |
| RLS rules     | `apps/backend/convex/rls.ts`        | Access control                      |

## CONVENTIONS

- Use `authQuery`, `authMutation`, `memberMutation`, `adminMutation`, or `permissionMutation` wrappers.
- File names are snake_case; exported functions are camelCase.
- Permission strings follow `resource:action` (see `auth.utils.ts`).
- Commit `apps/backend/convex/_generated/` after schema changes.

## ANTI-PATTERNS

- Raw Convex `query`/`mutation` without wrappers.
- Modify `apps/backend/convex/schemas/subscription_coupons.ts` or `apps/backend/convex/schemas/subscription_promo_codes.ts` directly.
- Update `creditsUsed` in `apps/backend/convex/stripe/handlers.ts` (preserve usage history).
- Edit `apps/backend/convex/_generated/*` manually.
