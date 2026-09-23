# apps/site — @seal/site

Astro 7 on a Cloudflare Worker. Owns `seal.nyc` / `www.seal.nyc`.

## Content

Marketing copy lives in typed Zod data under `src/data/` (`landing.ts`,
`changelog.ts`). Edit those files — components stay dumb renderers.

EmDash CMS is wired for optional admin workflows but is **not** the source of
truth for the public landing/changelog. Do not block site content on EmDash
collections being populated.

## Brand

Mark source: `packages/tokens/src/mark.svg` + `seal-mark.ts` (`MARK_SVG`,
currentColor). The quill — blade, spine, two barbs — single-color only.

Palette: Taupe 50–950 on `--brand-*`. Primary is taupe-900 `#2C271F` on
taupe-50 `#FBFAF9` — no product hue. Status hues (success/warning/destructive)
are functional, not brand.

Brand kit page lives at `/brand`. Wordmark is Hedvig Letters Serif.

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

## Migrating the site database to a new D1

`wrangler d1 export` cannot export databases containing FTS5 virtual tables
(Cloudflare-documented limitation — their workaround is delete + recreate the
virtual tables). EmDash's `ec_*` content tables, `_emdash_fts_*` tables, and
their triggers are created dynamically per collection, NOT by the migration
manifest — the manifest owns only `_emdash_*` system tables.

To clone this DB: run `emdash migrate` on the new DB (system schema), replay
missing DDL (`ec_*` tables, FTS `CREATE VIRTUAL TABLE`, `idx_ec_*`, triggers)
from the old DB's `sqlite_master`, then import data-only. FTS indexes
repopulate via triggers on insert — no manual rebuild needed.
