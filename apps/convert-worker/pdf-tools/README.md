# seal-pdf-tools container

Alpine + poppler-utils + ocrmypdf/tesseract + a stdlib-only Python HTTP
shim. Backs the `PdfTools` container class in `../wrangler.jsonc` for
operations the Gotenberg image cannot do (page rasterisation, text
extract, OCR; PDF/A and repair can land here too).

Endpoints (POST, `application/pdf` raw body):

- `/to-images?format=png|jpeg&dpi=50..600` → `application/zip` (`page-N.*`)
- `/to-text` → `text/plain` (`pdftotext -layout`)
- `/ocr?lang=eng` → `application/pdf` (ocrmypdf `--skip-text`)

Notes:

- Tesseract language data: `tesseract-ocr-data-eng` only today — add
  `tesseract-ocr-data-<lang>` packages to the image when more langs are
  needed; `lang` accepts `+`-joined codes (`eng+fra`).
- Tesseract OpenCL profiling writes `tesseract_opencl_profile_devices.dat`
  into CWD and pollutes stderr with `Error in pix*` lines that break
  ocrmypdf's lang check — `server.py` pre-warms it per workdir. `HOME=/tmp`
  is set so the profile write has a writable target.

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
land the bump in the same PR as the routes that need it. Build must target
`linux/amd64` — Apple Silicon `docker build` needs `--platform=linux/amd64`
or `wrangler containers push` rejects it:

```bash
docker build --platform=linux/amd64 -t seal-pdf-tools:v<N> apps/convert-worker/pdf-tools
pnpm exec wrangler containers push seal-pdf-tools:v<N>
```
