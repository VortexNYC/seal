# Seal

An open-source, agent-native e-signature platform. Built and powered by Vortex.

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
| `packages/react-sdk`     | Embeddable React signing SDK                  | TypeScript, React               |
| `packages/client`        | Typed API client                              | TypeScript                      |
| `packages/cli`           | `seal` CLI                                    | TypeScript                      |
| `packages/internal-auth` | Shared internal API-key auth                  | TypeScript                      |
| `packages/tokens`        | Shared theme / font tokens                    | CSS, TypeScript                 |
| `tooling/typescript`     | Shared TypeScript configuration               | TypeScript                      |

## Development

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
