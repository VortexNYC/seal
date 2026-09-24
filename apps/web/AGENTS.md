# WEB APP GUIDE

## OVERVIEW

React 19 SPA using TanStack Router (file-based) + Vite, Better Auth (`better-auth` + `@vortex-api/better-auth-ui`), and the Cloudflare Worker API (`apps/api`) for product data. **No `@vortexnyc/*` / Vortex Core.**

## STRUCTURE

```
apps/web/
├── src/
│   ├── routes/              # File-based routes
│   ├── components/          # UI + feature components
│   ├── lib/                 # Shared helpers (api-client, money, auth, pdf)
│   ├── hooks/               # Custom hooks
│   └── main.tsx             # App entry
└── e2e/                     # Playwright POM tests
```

## WHERE TO LOOK

| Task         | Location                                 | Notes                                            |
| ------------ | ---------------------------------------- | ------------------------------------------------ |
| Root layout  | `apps/web/src/routes/__root.tsx`         | Router setup + providers                         |
| Auth gate    | `apps/web/src/routes/_authenticated.tsx` | Session + org list via Better Auth client        |
| Route tree   | `apps/web/src/routes/`                   | File-based routes                                |
| App entry    | `apps/web/src/main.tsx`                  | Better Auth + TanStack Query + Router wiring     |
| API client   | `apps/web/src/lib/api-client.ts`         | Zod-typed Hono API client for `apps/api`         |
| Money        | `apps/web/src/lib/money.ts`              | Integer minor units; Seal-owned                  |
| Auth UI      | `@vortex-api/better-auth-ui`             | Sign-in/up, profile, team, security forms        |
| E2E fixtures | `apps/web/e2e/fixtures/`                 | Auth helpers + Worker API test fixtures          |
| E2E pages    | `apps/web/e2e/pages/`                    | Page Object Models                               |

## CONVENTIONS

- Routes use TanStack file-based routing: `_` prefix for layouts, `$` for params.
- Use `getErrorMessage()` / `parseApiError()` from `apps/web/src/lib/utils.ts` for API error messages.
- Use `buildOrganizationPath()` from `apps/web/src/lib/organization-path.ts` for org URLs.
- Prefer `data-testid` for E2E selectors; use POM pattern in `apps/web/e2e/pages/`.

### UI primitives — Cloudflare Kumo

All `apps/web` UI primitives are Cloudflare Kumo (`@cloudflare/kumo`).

- Import directly from `@cloudflare/kumo/components/*`.
- Do not create new local shadcn-style wrappers.
- `components/ui/input-currency.tsx` is the only remaining local file; it is a Kumo-based wrapper around `@react-input/number-format` for currency inputs.

### Branding / tenant identity

| Concern                                       | Owner  | Where                     |
| --------------------------------------------- | ------ | ------------------------- |
| Workspace name / slug / logo                  | Seal   | `settings/` (General)     |
| Tenant brand colors / email from              | Seal   | `settings/` (General)     |
| Hide “Powered by Seal”, custom signing footer | Seal   | `settings/branding`       |
| White-label gate                              | Seal   | Pro Sign SKU / FeatureGate |

Do not invent a parallel company-identity form outside settings.

### Org security policy

| Concern                     | Owner | Where                                     |
| --------------------------- | ----- | ----------------------------------------- |
| Org MFA / session timeout   | Seal  | General + auth wrappers / org switch      |
| API access + IP allowlist   | Seal  | `settings/security` + `api/context.ts`    |
| Document ownership transfer | Seal  | `settings/security` (`delegateOwnership`) |
| Personal 2FA                | Seal  | `settings/profile/security`               |

### Invite seats

Server-enforce `PLAN_LIMITS.*.maxSeats` on `createInvitation` (counts pending
invites) and `redeemInvitation` / `reactivateMember` / `addMember`. Team UI
Pro gate is UX only — mutations must reject Free / over-capacity.

### Signing product

E-sign domain is Seal product surface.

| Concern                                    | Owner | Where                              |
| ------------------------------------------ | ----- | ---------------------------------- |
| Signature types, deadlines, e-sign consent | Seal  | `settings/signing`                 |
| Public token signing UX / PDF canvas       | Seal  | `/sign/$token`                     |
| Recipient token security, embed SDK        | Seal  | `recipients_*`, `packages/sdk`     |
| Org logo / colors on sign chrome           | Seal  | Branding settings → sign tokens    |

### Path model

Authenticated product lives under `/{slug}/…`. `_authenticated` enforces session
+ org via Better Auth; slug layouts use `buildOrganizationPath` / `WorkspaceSlugGuard`.

| Path                                          | Notes                                      |
| --------------------------------------------- | ------------------------------------------ |
| `/_authenticated`                             | Session + org required                     |
| `/{slug}/home`, `/documents`, `/settings`, …  | Product routes                             |
| `/sign/$token`                                | Public recipient token flow                |
| `/onboarding`, choose-organization            | Pre-slug onboarding                        |

### Auth pages

Use `@vortex-api/better-auth-ui` forms (`SignInForm`, `ForgotPasswordForm`, etc.)
wired through `AuthProvider` + local Better Auth client. Do not add `@vortexnyc/auth`.

## ANTI-PATTERNS

- Edit `apps/web/src/routeTree.gen.ts` (generated by TanStack Router).
- Use CSS classes in E2E selectors.
- Bypass the authenticated layout / workspace slug guard for product routes.
- Import backend functions or generated types directly into product code.
- Add a new local Button/Card/Input for settings when `@cloudflare/kumo/components/*` already exports it.
- Add any `@vortexnyc/*` dependency.

## Quick Links

- [Vite docs](https://vitejs.dev/)
