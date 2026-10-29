# @seal/convert-worker

Gotenberg-backed document conversion on Cloudflare Containers (Durable Object
`Converter`, image pinned to `gotenberg:8` by sha256 in `wrangler.jsonc`).

## Scope (ADR-009)

Today: `POST /convert` — office/CSV → PDF (LibreOffice via Gotenberg).

Planned on this same Container (Seal Dockerfile `FROM` the pinned Gotenberg
digest — see `docs/pdf-toolkit-prep-spec.md`):

| Route | Tooling | Job |
| --- | --- | --- |
| `POST /pdf/compress` | `qpdf` / Ghostscript | Shrink draft PDFs |
| `POST /pdf/unlock` | `qpdf --decrypt` | Remove password (never log it) |
| `POST /pdf/ocr` | **`ocrmypdf` + Tesseract** | Searchable PDF — **not** Workers AI / SaaS OCR |

Page surgery (organize, watermark, page numbers, crop box, encrypt) stays on
`@seal/api` with `pdf-lib`. This worker is for binaries that do not belong in
the API isolate. Seal exposes tools for agents; it does not run Seal-hosted
model inference for PDF prep.

## Deploying

**Worker code** deploys via Artifacts → cloudflare-ci (`wrangler deploy` with
`--containers-rollout none` on the convert worker), which ships the Worker
without touching the container application.

**Container rollouts** (image bump, `instance_type`, `max_instances`, or any
change to the `containers` block) must be run locally:

```bash
pnpm exec wrangler login          # OAuth, once
pnpm run deploy                   # full deploy incl. container application
```

CI cannot do this: `PATCH /containers/applications` rejects API tokens today —
Cloudflare platform gap, same class as `cloudflare/workers-sdk#14741`. Re-check
that endpoint when rolling containers; if token support lands, wire it into
cloudflare-ci rather than restoring a GitHub Actions deploy workflow.

Since the image is pinned by digest, nothing here moves unless we move it —
that's the point. Worker code ships continuously; container config changes are
deliberate ops events.
