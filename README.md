<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/tokens/src/assets/logo/seal-lockup-dark.png">
  <img alt="Seal" src="packages/tokens/src/assets/logo/seal-lockup-light.png" width="300">
</picture>

**Contract infrastructure for your code and your agents.**
Where deals get done — upload, send, sign, audit, all API-first. Signing is free.

An open-source, agent-native e-signature platform. Built and powered by Vortex.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/VortexNYC/seal)

Deploy on your Cloudflare account (D1 + R2 auto-provisioned). Or from a clone:

```bash
pnpm install && pnpm exec wrangler login && pnpm selfhost
```

Details: [CONTRIBUTING.md — Deploy your own](./CONTRIBUTING.md#deploy-your-own-cloudflare).

|            |                                            |
| ---------- | ------------------------------------------ |
| **Site**   | [seal.nyc](https://seal.nyc)               |
| **Docs**   | [docs.seal.nyc](https://docs.seal.nyc)     |
| **API**    | `api.seal.nyc`                             |
| **MCP**    | `mcp.seal.nyc`                             |
| **Status** | [seal.nyc/status](https://seal.nyc/status) |

```bash
npm install @vortex-api/seal   # TypeScript — client + React + CLI
# Python + Go SDKs ship in-repo under packages/sdk-python and packages/sdk-go
```

## Stack

- **Runtime:** Cloudflare Workers
- **HTTP:** Hono + Zod
- **Relational data:** Cloudflare D1 + Drizzle ORM
- **Stateful coordination:** Durable Objects
- **Object / immutable storage:** R2
- **Auth:** better-auth through Vortex Auth
- **Frontend:** React 19 + TanStack Router + Vite
- **Docs:** blume (Astro) static site + OpenAPI reference
- **Tooling:** pnpm + Vite+ (`vp`)

## Workspace overview

| Path                     | Purpose                                       | Stack                           |
| ------------------------ | --------------------------------------------- | ------------------------------- |
| `apps/web`               | Main product app                              | React 19, TanStack Router, Vite |
| `apps/docs`              | Developer docs + API reference                | blume (Astro), MDX, OpenAPI     |
| `apps/api`               | Cloudflare Worker backend, REST API, webhooks | Hono, Drizzle, Zod, wrangler    |
| `apps/mcp-worker`        | MCP worker for Sign tools/resources           | Cloudflare Workers, MCP SDK     |
| `apps/anydoc-worker`     | Document ingestion service                    | Cloudflare Workers              |
| `apps/convert-worker`    | PDF conversion via Gotenberg container        | Cloudflare Workers, Containers  |
| `packages/transactional` | Transactional email templates                 | React Email                     |
| `packages/sdk`           | `@vortex-api/seal` — client, React SDK, CLI   | TypeScript, React               |
| `packages/internal-auth` | Shared internal API-key auth                  | TypeScript                      |
| `packages/tokens`        | Shared theme / font tokens                    | CSS, TypeScript                 |
| `tooling/typescript`     | Shared TypeScript configuration               | TypeScript                      |

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full local path.

```bash
pnpm install
pnpm run dev
```

Proof wall (run before committing):

```bash
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm test
```

## License

MIT — see [LICENSE](./LICENSE).
