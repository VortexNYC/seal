# PDF toolkit prep — implementation spec

**Status:** Active  
**Date:** 2026-09-30  
**ADR:** [ADR-009](./decisions/ADR-009-pdf-toolkit-prep-tools.md)  
**Workspace:** [ADR-008](./decisions/ADR-008-document-workspace-one-roof.md)

Seal matches Smallpdf-class **prep** without becoming Smallpdf or an AI OCR
vendor. Agents and humans call the same tools. Seal does not run Workers AI /
vision models on document bytes for these jobs.

## Doctrine (non-negotiable)

| Do | Don’t |
| --- | --- |
| Deterministic byte pipelines | Seal-hosted model inference for prep |
| OpenAPI → MCP / CLI / SDK → SPA | SPA-only or MCP-only forks |
| `pdf-lib` on the API Worker for page surgery | New PDF SaaS (Adobe, Apryse, iLovePDF) |
| `ocrmypdf` + Tesseract in **convert-worker** Containers for OCR | Workers AI vision, Mistral OCR, Textract |
| `qpdf` / Ghostscript in convert-worker for compress / unlock | Expect `pdf-lib` to match Smallpdf compress |
| EmbedPDF for preview / selection chrome | Mutate PDFs only in the browser |
| anydoc / pdf-inspector **detect** layout / `pagesNeedingOcr` | Treat detection as “Seal AI product” |

**Product stance:** Seal sells agreement tooling and signing. **AI agents**
(customer-owned) use Seal tools. Seal does not sell “our model read your PDF.”

## Current baseline (already shipped)

| Capability | Where |
| --- | --- |
| Office/CSV → PDF | convert-worker (Gotenberg / LibreOffice) via service binding |
| Merge / split / rotate | `apps/api/src/platform/pdf-ops.ts` + agent routes + Pages rail |
| Annotate / redact ops | `pdf-ops` annotate + Mark up on `DocumentCanvas` |
| Fields / sign | Document Workspace + public sign |
| Layout / field candidates | anydoc-worker + Layout rail |
| Original preview (read-only) | kumo-docs viewers — no edit-original |

## Target toolkit map

| Smallpdf-class job | Tier | Engine | Human surface | Agent tool (name target) |
| --- | --- | --- | --- | --- |
| Organize (delete / reorder / extract pages) | A | `pdf-lib` | Pages | `seal_organize_document_pdf` |
| Watermark | A | `pdf-lib` | Pages or Prep dock | `seal_watermark_document_pdf` |
| Page numbers | A | `pdf-lib` | Pages or Prep dock | `seal_number_document_pdf_pages` |
| Crop | A (+ EmbedPDF UI) | crop box via `pdf-lib` | Pages | `seal_crop_document_pdf` |
| Compress | B | `qpdf` and/or Ghostscript | Pages | `seal_compress_document_pdf` |
| Protect (encrypt) | A | `pdf-lib` encrypt | Pages | `seal_protect_document_pdf` |
| Unlock (decrypt) | B | `qpdf` | Pages | `seal_unlock_document_pdf` |
| OCR → searchable PDF | B | **`ocrmypdf` + Tesseract** | Pages (when `ocrRequired`) | `seal_ocr_document_pdf` |

All names are targets until OpenAPI lands — then MCP must match exactly
(ADR-003 / ADR-008). Prefer extending the **Pages** capability (and
`agentTools` list) over inventing a peer “Prep” mode unless the rail overflows.

## Cloudflare-native request path

```text
Agent / SPA
    → OpenAPI on @seal/api (auth, Zod, org scope)
        → R2 get draft PDF
        → Tier A: pdf-lib in Worker
           or Tier B: service binding → seal-convert-worker
                      → Container Durable Object (Converter)
                      → binary (qpdf / ocrmypdf / …)
        → R2 put new PDF (+ optional originals/ retention policy)
        → D1 document row: size, pageCount, ocrRequired clear, audit
    → MCP tool returns same JSON as OpenAPI
```

**Long jobs (OCR, large compress):**

1. `POST` returns `202` + `job_id` (or document `processing` status).
2. API enqueues a **Queue** consumer (or convert-worker completes and
   callbacks / writes status to R2 + D1).
3. SPA / agent polls document or job status — same pattern as convert-at-upload.
4. Never require the browser to hold an open request for minutes.

**Egress / privacy:** bytes stay on R2 + our Workers/Containers.
`egress.allow_convert` (and a future `egress.allow_pdf_tools` if we split the
flag) gates Tier B the same way office convert is gated today.

## Container image plan (Tier B)

Today: pinned `gotenberg/gotenberg:8@sha256:…` in
`apps/convert-worker/wrangler.jsonc`.

Target: Seal-owned Dockerfile:

```dockerfile
FROM gotenberg/gotenberg:8@sha256:<same-digest-as-today>
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf ghostscript ocrmypdf tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
# keep gotenberg entrypoint; add thin HTTP routes or sidecar scripts
# invoked by the Worker via container.fetch
USER gotenberg
```

Pin the **built** image by digest in `wrangler.jsonc`. Container application
rollouts stay local-ops per `apps/convert-worker/README.md` (CI ships Worker
code with `--containers-rollout none`).

Worker routes to add alongside `POST /convert`:

| Route | Binary | Notes |
| --- | --- | --- |
| `POST /pdf/compress` | `qpdf` / `gs` | Options: `profile=screen\|ebook\|printer` |
| `POST /pdf/unlock` | `qpdf --decrypt` | Password from request body; never log it |
| `POST /pdf/ocr` | `ocrmypdf` | `--skip-text` default; language pack `eng` first |

Internal auth: existing `@seal/internal-auth` on convert-worker.

## Phased delivery

Each phase: OpenAPI → API (+ convert-worker if Tier B) → MCP `agentTools` →
SPA Pages dock → vitest proof → Cap dogfood. No phase invents a second roof.

### Phase 1 — Organize pages (Tier A)

**Why first:** unblocks pack assembly; 100% `pdf-lib`; no container change.

- Extend `pdf-ops.ts`: `organizePdf({ order, delete, extract })` building on
  existing `splitPdfPages` / `mergePdfs` / `rotatePdfPages`.
- OpenAPI + `seal_organize_document_pdf`.
- Pages UI: reorder / delete / extract on the live canvas thumbnail strip.

**Done when:** agent and human can delete page 2 and reorder without leaving
Document Workspace; typecheck/lint/test green.

### Phase 2 — Watermark + page numbers (Tier A)

- `pdf-lib` drawText / drawImage; diagonal + footer presets.
- Tools: `seal_watermark_document_pdf`, `seal_number_document_pdf_pages`.
- SPA: short forms docked under Pages (text, opacity, position).

**Done when:** DRAFT watermark + “Page n of m” round-trip on a draft PDF.

### Phase 3 — Crop (Tier A + EmbedPDF chrome)

- UI: crop rect on `DocumentCanvas` (EmbedPDF / Konva overlay).
- Apply: set crop box / media box via `pdf-lib` (document when bake-vs-box).
- Tool: `seal_crop_document_pdf`.

**Done when:** crop one page, save, reload canvas shows trimmed view.

### Phase 4 — Compress (Tier B)

- Dockerfile + `POST /pdf/compress` on convert-worker.
- API: `seal_compress_document_pdf`; queue if over size/time threshold.
- SPA: one Compress action + before/after size.

**Done when:** scanned multi‑MB PDF shrinks measurably; digest-pinned image
deployed; no third-party compress API.

### Phase 5 — Protect / unlock (Tier A encrypt + Tier B decrypt)

- Protect: `pdf-lib` user/owner password encrypt on API.
- Unlock: `qpdf` in convert-worker (owner/user password); never store password;
  never log password.
- Tools: `seal_protect_document_pdf`, `seal_unlock_document_pdf`.
- Note: encrypted PDFs may break field placement — document UX (unlock before
  Fields, or block Fields while encrypted).

**Done when:** set password → download locked; unlock with password → Fields
work again.

### Phase 6 — OCR execution (Tier B) — **ocrmypdf + Tesseract only**

- `POST /pdf/ocr` → `ocrmypdf` (+ `eng` first; more langs later).
- API/MCP: `seal_ocr_document_pdf`.
- Gate UI/tool when document/`pdf-inspector` says `ocrRequired` /
  `pagesNeedingOcr`.
- After success: clear `ocrRequired`, re-run anydoc parse for text/layout
  (inspection only — still no Seal LLM).
- Prefer Queue + job status for multi-page scans.

**Done when:** scanned counterparty PDF becomes searchable; `parsedText`
populated; **zero** Workers AI / external OCR provider calls in the path.

## Explicitly deferred

| Item | Why |
| --- | --- |
| PDF → Word/Excel/PPT/JPG export | Not the agreement path; agents can use external tools |
| Repair PDF / compare PDFs | Niche; revisit after Phase 1–6 |
| Flatten forms as a named tool | May fall out of sign/final-pdf |
| Seal-hosted legal-review LLM (ADR-006) | Separate product; must not own OCR/compress |
| Second container product (non-Gotenberg) | Only if Dockerfile-FROM-Gotenberg fails size/compat |

## Proof wall (every phase)

From repo root:

```bash
pnpm run typecheck && pnpm run lint && pnpm run build && pnpm test
```

Plus phase-specific:

- Tier A: unit tests on `pdf-ops` with fixture PDFs.
- Tier B: convert-worker integration test or scripted container prove
  (compress size ↓, OCR text extractable).
- OpenAPI ↔ MCP name parity check (registry `agentTools`).
- Cap dogfood on Pages for the human path.

## Registry note (ADR-008)

Prefer growing **Pages** `agentTools` as prep tools land. If the rail label
“Pages” becomes a lie, rename once to **Pages & prep** (or split a **Prep**
capability) in the same PR that adds the overflow — do not accumulate a
parallel taxonomy.
