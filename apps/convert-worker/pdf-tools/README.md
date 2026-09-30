# seal-pdf-tools container

Alpine + poppler-utils + a stdlib-only Python HTTP shim. Backs the
`PdfTools` container class in `../wrangler.jsonc` for operations the
Gotenberg image cannot do (page rasterisation, text extract; add
ocrmypdf / ghostscript here when the OCR and PDF/A phases land).

Endpoints (POST, `application/pdf` raw body):

- `/to-images?format=png|jpeg&dpi=50..600` → `application/zip` (`page-N.*`)
- `/to-text` → `text/plain` (`pdftotext -layout`)

Optional shared-secret gate: set `PDF_TOOLS_API_KEY` on the container and
send `X-Internal-Api-Key`. Not wired today — the container is only
reachable through the `PdfTools` durable object, same as the Gotenberg
class.

## Rebuild and publish

```bash
# from repo root
pnpm exec wrangler containers build apps/convert-worker/pdf-tools -t seal-pdf-tools:v<N>
pnpm exec wrangler containers push seal-pdf-tools:v<N>
```

Then bump the tag in `../wrangler.jsonc` (dev + prod `PdfTools.image`) and
land the bump in the same PR as the routes that need it.
