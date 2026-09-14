# ADR-002: Kumo-only product UI

## Status

Accepted

## Date

2026-09-14

## Context

The Seal web app currently mixes three UI layers:

1. `@cloudflare/kumo` — used in a handful of settings routes
2. Local `@/components/ui/*` shadcn components — used throughout product surfaces
3. A stale `@vortexnyc/ui` Tailwind source directive in `styles.css`

The user experience, maintainability, and open-source positioning all improve if
there is a single UI layer. Kumo is Cloudflare's design system, it is the
intended future of the web app, and it already covers the primitives and
patterns we need.

## Decision

**The `apps/web` product UI will be Kumo-only.**

- All new product and settings work uses `@cloudflare/kumo` components and
  primitives.
- Existing local `@/components/ui/*` components are migrated to Kumo on touch,
  one surface at time.
- The `@vortexnyc/ui` Tailwind source directive is removed from `styles.css`.
- Iconography follows Kumo/Phosphor (`@phosphor-icons/react`) and is swapped
  away from `lucide-react` as surfaces are touched.

## Migration order

1. Remove the stale `@vortexnyc/ui` Tailwind source from `styles.css`.
2. Convert the settings routes that still use local `Card`/`Textarea` to Kumo
   `LayerCard`/`Text`/`Button`/`Input` patterns.
3. Convert the authenticated app shell (`app-sidebar`, `command-palette`,
   `page-wrapper`) to Kumo `Sidebar`, `CommandPalette`, and `Surface` primitives.
4. Convert product surfaces route-by-route: `home`, `documents`, `contacts`,
   `templates`, `analytics`, `signing`, `payments`.
5. Delete local `components/ui/*` files as they become unused.
6. Remove `lucide-react` once no icon imports remain.

## Consequences

- A single, consistent design system across the product.
- Smaller bundle and fewer third-party shadcn variants to maintain.
- Some Seal-specific chrome (document canvas, patterns, custom fields) may need
  to remain local until Kumo gains equivalents.
- Each converted surface requires a full typecheck + test pass before merge.
