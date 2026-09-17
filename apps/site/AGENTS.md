# apps/site — @seal/site

Astro 7 + EmDash CMS on a Cloudflare Worker. Owns `seal.nyc` / `www.seal.nyc`.

## Deploying

`@astrojs/cloudflare` generates `dist/server/wrangler.json` at **build time**,
resolved against whatever `CLOUDFLARE_ENV` was set during the build. `wrangler
deploy -e production` cannot merge `env.production` into that generated config —
it only validates `targetEnvironment`. Deploying a dev-built bundle silently
ships dev bindings.

Always deploy via the package scripts, which build with the env first:

```bash
pnpm run deploy          # CLOUDFLARE_ENV=production astro build && wrangler deploy -e production
pnpm run preview-deploy  # same build, wrangler versions upload --preview-alias
```

CI (`vortex-ci`) sets `CLOUDFLARE_ENV=production` in the repo `buildEnv` for the
same reason.

## D1 migrations

EmDash runs migrations automatically in-worker on first request (documented
default). The pre-deploy path is `emdash migrate`, which calls the Cloudflare
REST API and needs `CLOUDFLARE_API_TOKEN` with account D1 access:

```bash
CLOUDFLARE_API_TOKEN=... pnpm exec emdash migrate \
  --from-config --wrangler-config wrangler.toml \
  --wrangler-env production --account-id <account> --check   # or apply
```

On this machine, run it through the Veil broker — `password-manager run` injects
a placeholder the CF API rejects, and its HTTPS proxy corrupts binary (gzipped)
response bodies. A preload shim (`NODE_OPTIONS=-r <shim>`) that wraps
`globalThis.fetch` to call `password-manager use` per request works correctly.
The `cloudflare` Veil item has D1:Edit on the Vortex account.
