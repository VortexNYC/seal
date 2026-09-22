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

Vortex production IDs in `wrangler` configs are **not** yours. Replace them before
`wrangler deploy`, or you will try to bind Vortex D1/R2.

### 1. Create resources in your Cloudflare account

```bash
# From apps/api — names are examples
pnpm exec wrangler d1 create seal-documents
pnpm exec wrangler r2 bucket create seal-documents
```

Put the returned D1 `database_id` into `apps/api/wrangler.toml` under
`[env.production]` (and the local/dev block if you use remote dev). Set
`database_name` / `bucket_name` to match.

Repeat for sibling workers you plan to run:

| Worker | Config | Notes |
| --- | --- | --- |
| API | `apps/api/wrangler.toml` | D1 + R2 + Email + service bindings |
| Web | `apps/web/wrangler.jsonc` | Assets / `app` hostname |
| MCP | `apps/mcp-worker/wrangler.jsonc` | Points at your API origin |
| Anydoc | `apps/anydoc-worker/wrangler.jsonc` | Optional enrichment |
| Convert | `apps/convert-worker/wrangler.jsonc` | Optional DOCX→PDF (Containers) |

Update `[[env.production.services]]` worker names so API binds to **your**
anydoc/convert worker names (or remove those bindings until you need them).

### 2. Secrets

```bash
cd apps/api
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
pnpm exec wrangler secret put TOKEN_HASH_SECRET --env production
pnpm exec wrangler secret put INTERNAL_API_KEY --env production
# optional
pnpm exec wrangler secret put MCP_SIGNING_KEY --env production
```

Set production `vars` (`BETTER_AUTH_URL`, `APP_URL`, `ALLOWED_ORIGINS`,
`EMAIL_FROM`) to your domains.

### 3. Migrate + deploy

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply <your-db-name> --env production --remote
pnpm run deploy   # or: pnpm exec wrangler deploy -e production
```

Then deploy web/mcp (and optional workers) the same way. Point custom domains
at the Workers, or use `*.workers.dev` for a first spike.

### 4. Smoke

Create a user on your web origin → API key →:

```bash
SEAL_API_KEY=seal_… node scripts/smoke-prod.mjs --api https://<your-api>
```

Email in production needs Cloudflare Email Routing / a verified `EMAIL_FROM`
sender — local/dev will not send real mail by default.
## Code rules

- TypeScript strict: no `any`, no `@ts-ignore` / `@ts-expect-error`
- Auth is better-auth (Vortex Auth). Clerk is banned.
- pnpm only — never npm/yarn/bun for scripts
- Product UI primitives are Cloudflare Kumo
- Do not edit generated files (`apps/web/src/routeTree.gen.ts`, `apps/docs/dist/*`)

## Pull requests

Branch from `main`. Keep PRs small and prove them with the wall above.
