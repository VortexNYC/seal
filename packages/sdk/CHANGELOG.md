# @vortex-api/seal

## 0.4.0

### Minor Changes

- a2eaf15: Add `seal login`/`seal logout` to the CLI — RFC 8628 device flow that mints a scoped org API key into ~/.seal/config.json, plus stored-key fallback for all commands.

## 0.3.2

### Patch Changes

- npm `latest` promotion (same artifacts as 0.3.1; staged publish cleanup).

## 0.3.1

### Patch Changes

- Republish on npm `latest` after CI provenance staging delayed promotion of `0.3.0`.

## 0.3.0

### Minor Changes

- Add webhook delivery helpers (`verifySealWebhookSignature`, `parseSealWebhookEnvelope`, `readSealWebhookHeaders`) and regenerate OpenAPI types from the current `/reference` contract (send `email_sent` / `email_send_error`, `WebhookDeliveryPayload`).

## 0.2.1

### Patch Changes

- Fix the published CLI bin: ship `bin/seal.js` (Node cannot execute `.mjs` via the `bin` field on all npm clients). Align the package with the OpenAPI-first agent dogfood path used by `scripts/dogfood-cli.mjs`.

## 0.2.0

### Minor Changes

- First public npm surface for Seal: typed `SealClient` from OpenAPI, React `SealSigningEmbed`, and a thin `seal` CLI (`seal <METHOD> /api/v1/...` / `seal upload`).
