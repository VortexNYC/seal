# ADR-009: PDF toolkit prep tools — deterministic, agent-callable, CF-native

**Status:** Accepted  
**Date:** 2026-09-30  
**Supersedes (partial):** ADR-006 open question § “OCR execution” (Workers AI
vision / external SaaS OCR). That path is rejected for Seal.

## Context

Seal is an agreement-document platform: convert → PDF → review / mark up /
fields / sign. Humans and agents share one Document Workspace (ADR-008).
Classic eSign peers (DocuSign et al.) do not edit Word/Excel inside the
product; Smallpdf-class prep tools (compress, organize, OCR, protect,
watermark, page numbers, crop) are the remaining gap after removing the
Office SPA edit panel.

Two wrong forks were on the table:

1. **Seal-hosted model inference for PDF prep** (Workers AI vision, Mistral
   OCR, Textract) — we become an AI vendor for a job that is a binary
   pipeline.
2. **PDF SaaS** (Adobe PDF Services, Apryse, iLovePDF) — we rent Smallpdf.

Seal’s doctrine (ADR-003): agents do the work; Seal exposes OpenAPI/MCP tools.
Seal should not run “our AI” on document bytes for prep. Agents bring their
own models and call our tools.

## Decision

### 1. Deterministic tools, not Seal-side AI

PDF prep operations are **pure functions over bytes** (plus declared options).
No Workers AI, no vision LLM, no third-party OCR API for these jobs.

- **Seal provides tools.** OpenAPI → MCP / CLI / SDK. Humans get the same
  jobs on the Document Workspace rail (ADR-008).
- **Agents provide intelligence.** Field placement judgment, review, redline
  strategy — outside Seal’s prep pipeline.
- **Detection ≠ generation.** `@firecrawl/pdf-inspector-wasm` /
  anydoc-worker may still report `pagesNeedingOcr` / layout blocks. That is
  structured inspection, not Seal calling a model to “read” the page.

### 2. Two execution tiers (keep the stack you already have)

| Tier | Where | Engine | Jobs |
| --- | --- | --- | --- |
| **A — Worker-native** | `@seal/api` `platform/pdf-ops.ts` | **`pdf-lib`** (already ships merge / split / rotate / annotate / final-pdf) | Organize pages, watermark, page numbers, crop box, set password (encrypt) |
| **B — Container** | `@seal/convert-worker` (Cloudflare Containers + Durable Object `Converter`) | Extend the pinned image beyond Gotenberg LibreOffice | Compress (`qpdf` and/or Ghostscript), unlock/decrypt (`qpdf`), **OCR → searchable PDF (`ocrmypdf` + Tesseract)** |

Do **not** add a third PDF engine in the SPA. EmbedPDF / PDFium stays chrome
(preview, crop handles, page picker); mutations go through the API.

### 3. OCR = `ocrmypdf` + Tesseract in convert-worker

**Accepted:** run OCR inside the convert-worker container so the output is a
real searchable PDF written back to R2.

**Rejected for Seal OCR execution:**

- Workers AI vision
- Mistral OCR / AWS Textract / Google Document AI / Azure Read
- “Ask an LLM what’s on the page” as a Seal product path

anydoc / pdf-inspector continue to **flag** OCR need; convert-worker
**executes** when a human or agent calls the tool.

### 4. Cloudflare-native shape (no parallel platforms)

Every prep capability follows the same path:

1. **OpenAPI first** (`apps/docs/openapi.yaml`) — contract before UI.
2. **API Worker** authenticates, authorizes org/document, reads/writes **R2**,
   records audit metadata on the document row.
3. **Tier A** runs in-process with `pdf-lib`.
4. **Tier B** uses the existing **service binding** to `seal-convert-worker`
   (same pattern as office→PDF convert). Long jobs (OCR, large compress) may
   use **Queues** + status on the document — never block the browser on a
   multi-minute container run without a job id.
5. **MCP tools** mirror OpenAPI names (`seal_*`) and are listed on
   `DOCUMENT_CAPABILITIES` (ADR-008).
6. **SPA** is oversight: Pages (and later Prep) dock under `DocumentCanvas`;
   no new top-level product mode.

Container image changes remain **deliberate ops** (digest pin + local
`wrangler deploy` for container application — see
`apps/convert-worker/README.md`). Prefer one `Converter` image that keeps
Gotenberg and adds `qpdf` / `ocrmypdf` / Tesseract via a Seal-owned Dockerfile
`FROM gotenberg/gotenberg:8@sha256:…`, rather than a second vendor runtime.

### 5. Explicit non-goals

- In-app Word/Excel editing (removed; convert at intake only).
- PDF → Office export as a Seal product surface (agents/humans use external
  tools if they need editable sources).
- Seal-hosted generative “AI PDF editor”.
- Adobe / Apryse / Nutrient / iLovePDF APIs.

## Consequences

- Prep features ship as OpenAPI + `pdf-ops` / convert-worker endpoints, then
  rail chrome — never SPA-only.
- OCR quality/cost/latency are container sizing problems (`instance_type`,
  queue concurrency), not model-provider problems.
- Egress and privacy stay on R2 + our Workers; scanned contracts do not leave
  for a third-party OCR SaaS.
- ADR-006 legal-review LLM work (if pursued) stays a **separate** product
  surface; it must not become the OCR or compress path.

## Implementation order

See `docs/pdf-toolkit-prep-spec.md` — phased so each step is shippable and
proofable without boiling the ocean.
