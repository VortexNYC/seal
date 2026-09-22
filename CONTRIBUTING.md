# Contributing to Seal

Seal is an open-source, agent-native e-signature platform on Cloudflare Workers.

## Prerequisites

- Node.js 24+
- [pnpm](https://pnpm.io) 10+ (Vite+ / `vp` is fine too)
- Cloudflare account only when deploying your own Workers/D1/R2

No GitHub Packages token is required. Install uses the public npm registry only.
A Cloudflare account is optional for pure local `wrangler dev` (simulated D1/R2).
You need one to deploy your own instance.

## Install

```bash
pnpm install
```

## Develop (local Workers)

```bash
# 1. API secrets (local only — never commit)
cp apps/api/.dev.vars.example apps/api/.dev.vars
# edit values, or: openssl rand -base64 32

# 2. Web env
cp apps/web/.env.example apps/web/.env.local

# 3. Run API + web + docs
pnpm run dev
```

- API: `http://localhost:8787` (`wrangler dev` — local D1/R2 by default)
- Web: `http://localhost:5180` (Vite `PORT` default)
- Docs: blume site from `@seal/docs`

First run applies D1 migrations from `apps/api/migrations/` into the local D1.

PDF upload/sign works without convert-worker. DOCX→PDF and anydoc parsing need the sibling workers (`pnpm --filter @seal/anydoc-worker run dev`, `pnpm --filter @seal/convert-worker run dev`) — optional for the core signing loop.

Cloudflare Email binding is simulated locally; auth emails may only log unless you configure a real sender.

Targeted workspaces:

```bash
pnpm --filter @seal/api run dev
pnpm --filter @seal/web run dev
pnpm --filter @seal/docs run dev
```

## Proof wall (before every PR)

From the repo root:

```bash
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm test
```

## First signed document (hosted — start here)

Fastest path today (no local Workers required):

1. Open [app.seal.nyc/sign-up?next=developer](https://app.seal.nyc/sign-up?next=developer)
2. Verify email → create a workspace (name only; slug auto-fills)
3. Land on **Developer** settings → create an API key (`seal_…`)
4. Either:
   - **UI:** Documents → Upload → add recipients → Send → open the signing link
   - **API/MCP:** follow [docs.seal.nyc quick start](https://docs.seal.nyc/docs/getting-started/quick-start) or point an MCP client at `mcp.seal.nyc`
5. Optional proof: `SEAL_API_KEY=seal_… node scripts/smoke-prod.mjs`

Do not invent a Docker compose story the repo does not ship yet.

## Code rules

- TypeScript strict: no `any`, no `@ts-ignore` / `@ts-expect-error`
- Auth is better-auth (Vortex Auth). Clerk is banned.
- pnpm only — never npm/yarn/bun for scripts
- Product UI primitives are Cloudflare Kumo
- Do not edit generated files (`apps/web/src/routeTree.gen.ts`, `apps/docs/dist/*`)

## Pull requests

Branch from `main`. Keep PRs small and prove them with the wall above.
