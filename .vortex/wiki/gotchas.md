---
generated_at_sha: 1ef5d477cd84622dc2d17ef306386775c92aaeff
generated_at: 
---
# Seal — Gotchas (read BEFORE coding)

## Sign-in/sign-up UI is Clerk — its text is NOT in the route file
`apps/web/src/routes/_auth/sign-in.tsx` renders ONLY `<SignIn/>` from `@clerk/clerk-react`. There is
NO heading, subtitle, or button label to edit in that file. To change ANY sign-in/sign-up **copy**
(heading, subtitle, button text), edit the Clerk `localization` prop on `<ClerkProvider>` in
`apps/web/src/main.tsx` (localization keys like `formButtonPrimary`, `signIn.start.title`).
Editing sign-in.tsx to change the heading is WRONG and will not render.
(apps/web/src/main.tsx, apps/web/src/routes/_auth/sign-in.tsx)

## Web QA = Playwright e2e vs a Convex deployment (no wrangler preview)
Seal has no wrangler-versions preview-deploy. Web verification is Playwright e2e against a Convex
deployment (see `.vortex/qa.json` web.verify). Do not invent a preview-deploy command.
(.vortex/qa.json, apps/web/e2e/)

## Learned truths

- Seal has a separate marketing site at apps/landing (distinct from the apps/web app).  (apps/landing)
- Seal e2e smoke tests run the smoke-contract Playwright project: cd apps/web && bun run test:e2e --project=smoke-contract.  (.vortex/qa.json)  (human follow-up (Linear))
- Seal env vars for the web app are prefixed VITE_ (e.g. VITE_CONVEX_URL); server-only secrets are NOT VITE_-prefixed.  (apps/web/.env)
