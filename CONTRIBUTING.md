# Contributing to Seal

Seal is an open-source, agent-native e-signature platform on Cloudflare Workers.

## Prerequisites

- Node.js 24+
- [pnpm](https://pnpm.io) 10+ (Vite+ / `vp` is fine too)
- A Cloudflare account (for D1, R2, Workers) when you leave pure unit tests

No GitHub Packages token is required. Install uses the public npm registry only.

## Install

```bash
pnpm install
```

## Develop

```bash
pnpm run dev
```

That starts the API Worker, product web app, and docs. Targeted workspaces:

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

Local Worker wiring (wrangler D1/R2 secrets, convert-worker container) is next.
Do not invent a Docker compose story the repo does not ship yet.

## Code rules

- TypeScript strict: no `any`, no `@ts-ignore` / `@ts-expect-error`
- Auth is better-auth (Vortex Auth). Clerk is banned.
- pnpm only — never npm/yarn/bun for scripts
- Product UI primitives are Cloudflare Kumo
- Do not edit generated files (`apps/web/src/routeTree.gen.ts`, `apps/docs/dist/*`)

## Pull requests

Branch from `main`. Keep PRs small and prove them with the wall above.
