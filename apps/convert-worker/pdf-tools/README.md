# seal-pdf-tools container

Alpine + poppler-utils + ocrmypdf/tesseract + LibreOffice + a
stdlib-only Python HTTP shim. Backs the `PdfTools` container class in `../wrangler.jsonc` for
operations the Gotenberg image cannot do (page rasterisation, text
extract, OCR; PDF/A and repair can land here too).

Endpoints (POST, `application/pdf` raw body):

- `/to-images?format=png|jpeg&dpi=50..600` → `application/zip` (`page-N.*`)
- `/to-text` → `text/plain` (`pdftotext -layout`)
- `/to-words` → `application/json` (`pdftotext -bbox`; per-word 0–1
  coordinates — the citation-anchoring substrate)
- `/ocr?lang=eng` → `application/pdf` (ocrmypdf `--skip-text`)
- `/pdf-to-office?format=docx|xlsx|pptx` → office bytes (soffice `--headless
--convert-to`; PDF imports into Draw — layout-locked fidelity)

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

Use `cf` (the Cloudflare CLI) — it keeps its own credentials; sign in once
with `cf auth login` (it does not reuse a wrangler login):

```bash
# from repo root
cf containers build apps/convert-worker/pdf-tools
cf containers push --tag seal-pdf-tools:v<N>
```

Then bump the tag in `../wrangler.jsonc` (dev + prod `PdfTools.image`) and
land the bump in the same PR as the routes that need it. Build must target
`linux/amd64` — on Apple Silicon build explicitly or the push is rejected:

```bash
docker build --platform=linux/amd64 -t seal-pdf-tools:v<N> apps/convert-worker/pdf-tools
cf containers push --tag seal-pdf-tools:v<N>
```
