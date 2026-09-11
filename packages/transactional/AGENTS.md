# TRANSACTIONAL EMAIL GUIDE

## OVERVIEW

React Email templates for **Seal document / product** notifications. Shared
shell, brand helpers, and `renderEmail` come from `@vortexnyc/email`. Auth
verify / reset / org-invite HTML is owned by `@vortexnyc/auth` Better Auth drafts
— do not add parallel auth templates here.

## STRUCTURE

```
packages/transactional/
├── src/
│   ├── emails/          # Seal document templates + Core layout adapter
│   └── index.tsx        # Central exports + renderers (via renderEmail)
```

## WHERE TO LOOK

| Task          | Location                               | Notes                                      |
| ------------- | -------------------------------------- | ------------------------------------------ |
| Template list | `packages/transactional/src/emails/`   | Kebab-case files                           |
| Layout shell  | `emails/email-layout.tsx`              | Thin adapter over `@vortexnyc/email`       |
| Exports       | `packages/transactional/src/index.tsx` | Components + `renderX()` helpers           |
| Auth emails   | `@vortexnyc/auth`                      | Not in this package                        |
| Transport     | `apps/api/src/platform/email.ts`       | Worker `send_email` binding + Resend transport. |

## CONVENTIONS

- File names are kebab-case; component names are PascalCase.
- Each template exports a `Props` interface, named component, and default export.
- `src/index.tsx` re-exports components/types and provides `renderX()` helpers via Core `renderEmail`.
- Templates use `@react-email/components` for document-specific chrome; shell/brand from Core.

## ANTI-PATTERNS

- Export templates without matching `renderX()` in `src/index.tsx`.
- Hand-roll a second Html/Head/Preview/Body shell — use `EmailLayout` (Core adapter).
- Add auth verify / password-reset / org-invite HTML here (use Auth drafts).
