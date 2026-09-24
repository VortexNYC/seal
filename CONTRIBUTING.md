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
   - **API/MCP:** follow [docs.seal.nyc quick start](https://docs.seal.nyc/getting-started/quick-start) or point an MCP client at `mcp.seal.nyc`
5. Optional proof: `SEAL_API_KEY=seal_… node scripts/smoke-prod.mjs`

Do not invent a Docker compose story the repo does not ship yet.

## Deploy your own (Cloudflare)

### Friendly path — Deploy to Cloudflare

Seal is a pnpm monorepo, so the button opens Workers Builds against the full
repo. On the setup screen, set:

| Field          | Value           |
| -------------- | --------------- |
| Root directory | `/` (repo root) |
| Build command  | `pnpm install`  |
| Deploy command | `pnpm selfhost` |

Or click through and then run `pnpm selfhost` locally after `wrangler login` —
same `selfhost` env either way.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/VortexNYC/seal)

What you get:

- Auto-provisioned **D1** + **R2** (no Vortex resource IDs)
- API + web on `*.workers.dev`
- Secrets prompted once (`BETTER_AUTH_SECRET`, `TOKEN_HASH_SECRET`, `INTERNAL_API_KEY`)

### CLI (recommended for monorepo)

```bash
pnpm install
pnpm exec wrangler login
pnpm selfhost
```

`scripts/selfhost.sh` deploys `[env.selfhost]` in `apps/api` + `apps/web`, runs
D1 migrations by **binding name**, and wires `BETTER_AUTH_URL` /
`ALLOWED_ORIGINS` / `APP_URL` to your real workers.dev URLs.

Non-interactive secrets:

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
TOKEN_HASH_SECRET=$(openssl rand -base64 32) \
INTERNAL_API_KEY=$(openssl rand -base64 32) \
pnpm selfhost
```

### Manual path

Vortex production IDs in the default/`production` wrangler blocks are **not**
yours. Use `[env.selfhost]` (no account IDs) or create your own D1/R2 and point
`production` at them.

```bash
# From apps/api — only if you are NOT using selfhost auto-provision
pnpm exec wrangler d1 create seal-documents
pnpm exec wrangler r2 bucket create seal-documents
```

| Worker  | Config                               | Notes                              |
| ------- | ------------------------------------ | ---------------------------------- |
| API     | `apps/api/wrangler.toml`             | Use `[env.selfhost]` or your D1/R2 |
| Web     | `apps/web/wrangler.jsonc`            | `[env.selfhost]` → workers.dev     |
| MCP     | `apps/mcp-worker/wrangler.jsonc`     | Optional                           |
| Anydoc  | `apps/anydoc-worker/wrangler.jsonc`  | Optional enrichment                |
| Convert | `apps/convert-worker/wrangler.jsonc` | Optional DOCX→PDF (Containers)     |

```bash
cd apps/api
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env selfhost
pnpm exec wrangler secret put TOKEN_HASH_SECRET --env selfhost
pnpm exec wrangler secret put INTERNAL_API_KEY --env selfhost
pnpm run deploy:selfhost

cd ../web
VITE_API_URL=https://seal-api.<account>.workers.dev \
VITE_BETTER_AUTH_URL=https://seal-api.<account>.workers.dev \
VITE_APP_URL=https://seal-web.<account>.workers.dev \
pnpm run deploy:selfhost
```

### Smoke

```bash
SEAL_API_KEY=seal_… node scripts/smoke-prod.mjs --api https://seal-api.<account>.workers.dev
```

Email needs Cloudflare Email Routing / a verified `EMAIL_FROM` — omitted from
`selfhost` until you add an `[[env.selfhost.send_email]]` binding. Local/dev
does not send real mail by default.

**Do not** run `pnpm selfhost` while logged into the Vortex Cloudflare account —
worker names collide with hosted production. Use a separate account (the script
refuses Vortex unless `SEAL_SELFHOST_FORCE=1`).

## Code rules

- TypeScript strict: no `any`, no `@ts-ignore` / `@ts-expect-error`
- Auth is better-auth (Vortex Auth). Clerk is banned.
- pnpm only — never npm/yarn/bun for scripts
- Product UI primitives are Cloudflare Kumo
- Do not edit generated files (`apps/web/src/routeTree.gen.ts`, `apps/docs/dist/*`)

## Pull requests

Branch from `main`. Keep PRs small and prove them with the wall above.
