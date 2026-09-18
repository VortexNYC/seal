# @seal/convert-worker

Gotenberg-backed document conversion on Cloudflare Containers (Durable Object
`Converter`, image pinned to `gotenberg:8` by sha256 in `wrangler.jsonc`).

## Deploying

**Worker code** deploys in CI via `deploy.yml` — it runs
`wrangler deploy -e production --containers-rollout none`, which ships the
Worker without touching the container application.

**Container rollouts** (image bump, `instance_type`, `max_instances`, or any
change to the `containers` block) must be run locally:

```bash
pnpm exec wrangler login          # OAuth, once
pnpm run deploy                   # full deploy incl. container application
```

CI cannot do this: `PATCH /containers/applications` rejects API tokens today —
Cloudflare platform gap, same class as `cloudflare/workers-sdk#14741`.
`deploy.yml`'s `deploy-containers` job probes the endpoint each run and will
start rolling out automatically if/when token support lands.

Since the image is pinned by digest, nothing here moves unless we move it —
that's the point. Worker code ships continuously; container config changes are
deliberate ops events.
