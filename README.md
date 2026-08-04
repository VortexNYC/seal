# Seal

<!-- val-seed: 1776633784549 -->

<!-- val-token: 1776628674114 -->

<!-- val-dup-seed-1776635330428 -->

<!-- val-seed: 1776652153608 -->
<!-- merge-deploy-rung: 1778772723448 -->

Seal is a Bun + Turborepo monorepo for the Seal document-signing platform.
It contains the product web app, the public site and developer docs, the Convex backend, and the MCP server.
It also includes transactional email templates, an embeddable React SDK, and shared design tokens.

## Workspace Overview

| Path                     | Purpose                                     | Stack                                                |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| `apps/web`               | Main product app                            | React 19, TanStack Router, Vite, Better-Auth, Convex |
| `apps/landing`           | Marketing site and published developer docs | TanStack Start, Fumadocs, local content              |
| `apps/backend`           | Convex backend, REST API, webhooks, jobs    | Convex, TypeScript                                   |
| `apps/mcp-server`        | MCP server for Seal tools/resources         | Bun, Express, MCP SDK                                |
| `packages/transactional` | Transactional email templates               | React Email                                          |
| `packages/react-sdk`     | Embeddable React SDK                        | TypeScript                                           |
| `packages/tokens`        | Shared theme/font tokens                    | CSS, TypeScript                                      |
| `tooling/typescript`     | Shared TS config                            | TypeScript                                           |

## Prerequisites

- Bun `1.3.0` or newer
- A Convex deployment for backend-backed local work
- Better-Auth (via @vortexnyc/vortex-auth) is the auth provider; no external auth credentials needed for local work
- Optional: Vortex Payments, Resend, and other integration secrets for billing/email flows

Install dependencies once from the repo root:

```bash
pnpm install
```

## Local Development

Use the root `dev` command for the main product stack:

```bash
pnpm run dev
```

That starts:

- `@seal/backend`
- `@seal/web`

There is still no root `start` script.

Equivalent targeted commands:

```bash
pnpm exec vp run -r dev --filter=@seal/backend
pnpm exec vp run -r dev --filter=@seal/web
```

Other useful non-default targets:

```bash
pnpm exec vp run -r dev --filter=@seal/landing
pnpm exec vp run -r dev --filter=@seal/mcp-server
pnpm exec vp run -r dev --filter=@seal/transactional
```

Notes:

- `apps/landing` defaults to port `5181`.
- `packages/transactional` defaults to port `3001`.
- `apps/mcp-server` defaults to port `5183`.
- Playwright E2E assumes the product app is available at `http://localhost:5180`.

## Environment Variables

The exact env set depends on which workspace you are running.

### Product App (`apps/web`)

Required for boot:

- `VITE_CONVEX_URL`

Common optional vars:

- `VITE_PUBLIC_POSTHOG_KEY`
- `VITE_APP_URL`

### Backend (`apps/backend`)

Common vars used by the Convex backend include:

- `BETTER_AUTH_SECRET`
- `VORTEX_BILLING_API_KEY`
- `VORTEX_BILLING_BASE_URL`
- `VORTEX_BILLING_WEBHOOK_SECRET`
- `VORTEX_PAYMENTS_API_KEY`
- `VORTEX_PAYMENTS_BASE_URL`
- `SIGNATURE_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`

Additional integration-specific vars are referenced throughout `apps/backend/convex`.

### MCP Server (`apps/mcp-server`)

Common vars:

- `SEAL_API_BASE_URL`
- `SEAL_API_KEY`
- `SEAL_REQUEST_TIMEOUT`
- `SEAL_DEBUG`
- `PORT`

### E2E (`apps/web`)

Use [apps/web/.env.test.example](apps/web/.env.test.example) as the starting point for Playwright config.

## Common Commands

Run these from the repo root unless noted otherwise.

```bash
pnpm run dev
pnpm run build
pnpm run lint
pnpm run format
pnpm run format:check
pnpm run typecheck
pnpm run knip
pnpm run verify
pnpm run test
```

Target a single workspace when you want faster feedback:

```bash
pnpm exec vp run -r test --filter=@seal/backend
pnpm exec vp run -r test --filter=@seal/web
pnpm exec vp run -r build --filter=@seal/landing
```

## E2E Testing

Install Playwright browsers:

```bash
pnpm --dir apps/web exec playwright install chromium
pnpm --dir apps/landing exec playwright install chromium firefox webkit
```

Run the test suite:

```bash
pnpm --dir apps/web run test:e2e
pnpm --dir apps/landing run test:e2e
```

Useful variants:

```bash
pnpm --dir apps/web run test:e2e:ui
pnpm --dir apps/web run test:e2e:headed
pnpm --dir apps/web run test:e2e:debug
pnpm --dir apps/landing run test:e2e:ui
pnpm --dir apps/landing run test:e2e:headed
pnpm --dir apps/landing run test:e2e:debug
```

More detail lives in [apps/web/e2e/README.md](apps/web/e2e/README.md) and [apps/landing/e2e/README.md](apps/landing/e2e/README.md).

## Docs and API Reference

Published developer docs live in `apps/landing/content/docs`.

Useful landing/docs commands:

```bash
pnpm --dir apps/landing run content:prepare
pnpm --dir apps/landing run docs:generate:api
pnpm --dir apps/landing run content:search
pnpm --dir apps/landing run content:sitemap
```

The API reference content is generated from `apps/landing/openapi.yaml`.

## Additional References

- Contributor notes: [AGENTS.md](AGENTS.md)
- Landing/docs guide: [apps/landing/AGENTS.md](apps/landing/AGENTS.md)
- Web app guide: [apps/web/AGENTS.md](apps/web/AGENTS.md)
- Backend guide: [apps/backend/convex/AGENTS.md](apps/backend/convex/AGENTS.md)
- MCP server details: [apps/mcp-server/README.md](apps/mcp-server/README.md)
- E2E testing playbook: [apps/web/e2e/README.md](apps/web/e2e/README.md)

<!-- val-token: 1776627247462 -->
<!-- vortex victory 4 2026-05-07 -->
