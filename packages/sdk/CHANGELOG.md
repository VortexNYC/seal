# @vortex-api/seal

## 0.2.1

### Patch Changes

- Fix the published CLI bin: ship `bin/seal.js` (Node cannot execute `.mjs` via the `bin` field on all npm clients). Align the package with the OpenAPI-first agent dogfood path used by `scripts/dogfood-cli.mjs`.

## 0.2.0

### Minor Changes

- First public npm surface for Seal: typed `SealClient` from OpenAPI, React `SealSigningEmbed`, and a thin `seal` CLI (`seal <METHOD> /api/v1/...` / `seal upload`).
