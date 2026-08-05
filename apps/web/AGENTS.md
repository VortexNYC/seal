# WEB APP GUIDE

## OVERVIEW

React 19 SPA using TanStack Router (file-based) + Vite, with Better-Auth through Vortex Auth (`@vortexnyc/auth`) and Convex data.

## STRUCTURE

```
apps/web/
├── src/
│   ├── routes/              # File-based routes
│   ├── components/          # UI + feature components
│   ├── lib/                 # Shared helpers (errors, formatting, pdf)
│   ├── hooks/               # Custom hooks
│   └── main.tsx             # App entry
└── e2e/                     # Playwright POM tests
```

## WHERE TO LOOK

| Task            | Location                                           | Notes                                |
| --------------- | -------------------------------------------------- | ------------------------------------ |
| Root layout     | `apps/web/src/routes/__root.tsx`                   | Router setup + providers             |
| Auth gate       | `apps/web/src/routes/_authenticated.tsx`           | Core `AuthAuthenticatedRouteGate` + Seal slug guard |
| Route tree      | `apps/web/src/routes/`                             | File-based routes                    |
| Convex usage    | `apps/web/src/main.tsx`                            | Better-Auth + Convex + Router wiring |
| E2E fixtures    | `apps/web/e2e/fixtures/`                           | Auth + Convex helpers                |
| E2E pages       | `apps/web/e2e/pages/`                              | Page Object Models                   |

## CONVENTIONS

- Routes use TanStack file-based routing: `_` prefix for layouts, `$` for params.
- Use `parseConvexError()` from `apps/web/src/lib/utils.ts` for mutation errors.
- Use `buildOrganizationPath()` from `apps/web/src/lib/organization-path.ts` for org URLs.
- Prefer `data-testid` for E2E selectors; use POM pattern in `apps/web/e2e/pages/`.

### UI primitives (`@vortexnyc/ui` vs local shadcn) — SEA-592

Incremental CORE-FIRST cutover. Do **not** big-bang replace `components/ui/*`.

| Surface | Prefer | Notes |
| ------- | ------ | ----- |
| New / touched **platform & auth settings** | `@vortexnyc/ui` | Button, Card, Input, Label, Switch, Select, Separator, Dialog, … |
| **Product signing canvas** / document editor | `@/components/ui/*` | Seal-specific density & chrome stay local |
| Primitive Core does not ship (e.g. `Textarea`, `Progress`, `AlertDialog`) | `@/components/ui/*` | Until Core adds it — then migrate on touch |

Rules:

1. When editing a settings/auth route, switch imports for Core-available primitives to `@vortexnyc/ui`.
2. Do **not** import `@vortexnyc/ui/styles.css` — Seal already owns design tokens; Core primitives use token **names** only.
3. Do not grow new local shadcn clones of Core-shipped primitives for platform surfaces.
### Branding / tenant identity (SEA-603)

| Concern | Owner | Where |
| ------- | ----- | ----- |
| Workspace name / slug / logo | Core `VortexOrganizationProfile` | `settings/` (General) |
| Tenant brand colors / email from | Core (VOR-182) — Seal store until then | Temporary: `settings/branding` |
| Hide “Powered by Seal”, custom signing footer | **Seal** (Sign chrome) | `settings/branding` |
| White-label gate | Pro Sign SKU (`PLAN_LIMITS.*.branding`) | `FeatureGate` on branding |

Do not grow a parallel company-identity form on Branding; prefer General + Core.

### Org security policy (SEA-604)

| Concern | Owner | Where |
| ------- | ----- | ----- |
| Org MFA / session timeout enforcement | Core Auth (VOR-183) | Not written from Seal UI/API |
| API access + IP allowlist | **Seal** | `settings/security` + `api/context.ts` |
| Document ownership transfer | **Seal** | `settings/security` (`delegateOwnership`) |
| Personal 2FA | Core / profile | `settings/profile/security` |

Do not re-add Session Security toggles on org settings until Core owns them.

### Invite seats (SEA-605)

Server-enforce `PLAN_LIMITS.*.maxSeats` on `createInvitation` (counts pending
invites) and `redeemInvitation` / `reactivateMember` / `addMember`. Team UI
Pro gate is UX only — mutations must reject Free / over-capacity. Suite seat
entitlements in Core come later.

### Signing product stays Seal (SEA-594)

**KEEP_SEAL** — e-sign domain is the Sign product, not a Core platform surface.

| Concern | Owner | Where |
| ------- | ----- | ----- |
| Signature types, deadlines, e-sign consent | **Seal** | `settings/signing`, org `signingSettings` |
| Public token signing UX / PDF canvas | **Seal** | `/sign/$token` (`sign.$token.tsx`) |
| Recipient token security, embed SDK | **Seal** | `recipients_*`, `packages/react-sdk` |
| Org logo / colors on sign chrome | Core brand when VOR-182 lands | Apply tokens; do not invent identity here |

Do not move signing settings or `/sign/$token` into `@vortexnyc/auth`.

### Suite path model (SEA-606)

Authenticated product lives under `/{slug}/…`. Core owns auth + org membership via
`AuthAuthenticatedRouteGate`; Seal keeps a thin `WorkspaceSlugGuard` that redirects
into the active workspace slug (does not re-check auth).

| Path | Owner | Notes |
| ---- | ----- | ----- |
| `/_authenticated` gate | Core `AuthAuthenticatedRouteGate` | Auth session + org required |
| `/{slug}/home`, `/documents`, `/settings`, … | **Seal** product | `buildOrganizationPath` / `$slug` layout |
| `/sign/$token` | **Seal** (public) | Outside slug; recipient token flow |
| `/onboarding`, `/choose-organization` | Suite / Core chooser | Slug guard skips / redirects |
| `useCurrentUser` | Thin Clerk-shaped adapter over `useAppUser` | Prefer `useAppUser` on new code |
| `activeOrganizationId` + `activeVortexAuthOrganizationId` | Bridge until one canonical pointer | Do not add a third |

`EnforceOrganization` is gone — do not revive a parallel auth gate.

## ANTI-PATTERNS

- Edit `apps/web/src/routeTree.gen.ts` (generated by TanStack Router).
- Use CSS classes in E2E selectors.
- Bypass `AuthAuthenticatedRouteGate` / workspace slug guard for authenticated routes.
- Import Convex functions directly from `../../convex/_generated/api`.
- Add a new local Button/Card/Input for settings when `@vortexnyc/ui` already exports it.

## Quick Links

- [Vite docs](https://vitejs.dev/)
