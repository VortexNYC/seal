---
generated_at_sha: 1ef5d477cd84622dc2d17ef306386775c92aaeff
generated_at: 2026-07-08
---
# Seal — Architecture (agent context)

Seal is a contracts / document-signing app. Turbo monorepo.

## Modules
- `apps/web` — main web app (Vite + React), deployed to Cloudflare Workers. Routes in `apps/web/src/routes/`.
- `apps/backend` — Convex backend (functions + schema) in `apps/backend/convex/`.
- `apps/landing` — marketing site.

## Auth
Auth is **Clerk**. Sign-in/sign-up use Clerk's prebuilt `<SignIn/>` / `<SignUp/>` components. See gotchas.md for how their text is changed — it is NOT in the route file.

## Backend / QA / Deploy
- Data: Convex (`apps/backend`); web reads `VITE_CONVEX_URL`.
- Web QA: Playwright e2e (`cd apps/web && bun run test:e2e`, see `.vortex/qa.json`). Backend: vitest.
- Deploy: Convex + Cloudflare Workers. CI runs tests only (no preview-deploy flow).