# Vortex Sign

An open-source, agent-native e-signature platform.

## Stack

- **Runtime:** Cloudflare Workers
- **HTTP:** Hono + Zod
- **Relational data:** Cloudflare D1 + Drizzle ORM
- **Stateful coordination:** Durable Objects
- **Object / immutable storage:** R2
- **Auth:** better-auth through Vortex Auth
- **Frontend:** React 19 + TanStack Router + Vite
- **Docs / landing:** TanStack Start + Fumadocs
- **Tooling:** pnpm + Vite+ (`vp`)

## Workspace overview

| Path                     | Purpose                                       | Stack                                      |
| ------------------------ | --------------------------------------------- | ------------------------------------------ |
| `apps/web`               | Main product app                              | React 19, TanStack Router, Vite            |
| `apps/landing`           | Marketing site and published developer docs   | TanStack Start, Fumadocs                   |
| `apps/backend`           | Worker backend, REST API, webhooks, jobs      | Cloudflare Workers, Hono, Drizzle, Zod     |
| `apps/mcp-worker`        | MCP worker for Sign tools/resources           | Cloudflare Workers, MCP SDK                |
| `packages/transactional` | Transactional email templates                 | React Email                                |
| `packages/react-sdk`     | Embeddable React signing SDK                  | TypeScript, React                          |
| `packages/tokens`        | Shared theme / font tokens                    | CSS, TypeScript                            |
| `tooling/typescript`     | Shared TypeScript configuration               | TypeScript                                 |

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
