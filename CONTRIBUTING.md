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

## First signed document (hosted path)

Until a full self-host guide lands, the fastest way to try Seal is the hosted API:

1. Create an account at [app.seal.nyc](https://app.seal.nyc)
2. Create a workspace and an API key (`seal_tk_…`)
3. Follow [docs.seal.nyc](https://docs.seal.nyc) — upload → recipients → send → sign
4. Or point the MCP client at `mcp.seal.nyc`

Local Worker wiring (wrangler D1/R2 secrets, convert-worker container) is next; do not invent a Docker story that the repo does not ship yet.

## Code rules

- TypeScript strict: no `any`, no `@ts-ignore` / `@ts-expect-error`
- Auth is better-auth (Vortex Auth). Clerk is banned.
- pnpm only — never npm/yarn/bun for scripts
- Product UI primitives are Cloudflare Kumo
- Do not edit generated files (`apps/web/src/routeTree.gen.ts`, `apps/docs/dist/*`)

## Pull requests

Branch from `main`. Keep PRs small and prove them with the wall above.
