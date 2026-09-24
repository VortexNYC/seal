# TRANSACTIONAL EMAIL GUIDE

## OVERVIEW

React Email templates for **Seal document / product** notifications. Layout,
brand tokens, and `renderX()` helpers live in this package (`@react-email/*` +
`@seal/tokens`). **No `@vortexnyc/email` / `@vortexnyc/auth`.**

## STRUCTURE

```
packages/transactional/
├── src/
│   ├── emails/          # Document templates + EmailLayout
│   ├── styles.js        # Literal email colors/fonts
│   └── index.tsx        # Central exports + renderers
```

## WHERE TO LOOK

| Task          | Location                               | Notes                                         |
| ------------- | -------------------------------------- | --------------------------------------------- |
| Template list | `packages/transactional/src/emails/`   | Kebab-case files                              |
| Layout shell  | `emails/email-layout.tsx`              | Seal-owned Html/Head/Preview/Body             |
| Exports       | `packages/transactional/src/index.tsx` | Components + `renderX()` via `@react-email/render` |
| Transport     | `apps/api/src/platform/email.ts`       | Cloudflare `send_email` binding (`EMAIL`)     |

## CONVENTIONS

- File names are kebab-case; component names are PascalCase.
- Each template exports a `Props` interface, named component, and default export.
- `src/index.tsx` re-exports components/types and provides `renderX()` helpers.
- Templates use `@react-email/components`; shell/brand from `email-layout.tsx` + `styles.js`.

## ANTI-PATTERNS

- Export templates without matching `renderX()` in `src/index.tsx`.
- Hand-roll a second Html/Head/Preview/Body shell — use `EmailLayout`.
- Add `@vortexnyc/*` email packages.
