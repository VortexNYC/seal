# TRANSACTIONAL EMAIL GUIDE

## OVERVIEW
React Email templates for transactional notifications, exported as render functions.

## STRUCTURE
```
packages/transactional/
├── src/
│   ├── emails/          # One file per template
│   └── index.tsx        # Central exports + renderers
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Template list | `packages/transactional/src/emails/` | Kebab-case files |
| Exports | `packages/transactional/src/index.tsx` | Components + render functions |

## CONVENTIONS
- File names are kebab-case; component names are PascalCase.
- Each template exports a `Props` interface, named component, and default export.
- `src/index.tsx` re-exports components/types and provides `renderX()` helpers.
- Templates use `@react-email/components` + Tailwind classes.

## ANTI-PATTERNS
- Export templates without matching `renderX()` in `src/index.tsx`.
- Replace the shared HTML layout structure (Html/Head/Preview/Body/Container).
