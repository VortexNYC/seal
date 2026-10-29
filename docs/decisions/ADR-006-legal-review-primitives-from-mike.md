# ADR-006: Legal review primitives inspired by Mike, reimplemented natively

## Status

Proposed

## Date

2026-09-25

## Context

[Mike](https://github.com/open-legal-products/mike) (AGPL-3.0) was stood up
locally and dogfooded as a candidate legal platform. It proves the shape of
what Seal lacks: document-grounded chat with tools, tracked-changes docx
editing, tabular review matrices with pinpoint citations, a curated workflow
corpus, and citation verification.

Mike's license makes code extraction radioactive: pasting AGPL code into Seal
would make Seal a derivative work, and AGPL §13 reaches *network-served* users.
Separately, most of Mike is dead weight for us — Supabase auth, a Next.js app,
an Express monolith — none of which maps onto Seal's Workers + D1 + R2 stack.

Seal already owns a *better* ingestion layer than Mike's:

- `anydoc-worker`: `@firecrawl/anydoc-wasm` (any format → markdown) and
  `@firecrawl/pdf-inspector-wasm` (pdfType, `pagesNeedingOcr`, layout) — versus
  Mike's LibreOffice + pdfjs pipeline with no OCR detection.
- `convert-worker`: containerized docx/xlsx/pptx/csv conversion; ADR-009 also
  parks deterministic PDF binaries here (`qpdf`, `ocrmypdf` + Tesseract) —
  not Workers AI vision for OCR.
- `documents` already carries `parsedText`, `fieldCandidates`,
  `extractionSchema`, `parentDocumentId`, `ocrRequired`.
- `ai_field_suggestions` / `ai_document_annotations` tables exist with
  `modelUsed`/`tokensUsed` audit columns — but **no model provider is wired**.

The gap is not ingestion. It is: no LLM calls, no review-time primitives, no
citation layer, no revision/editing story, and no legal-workflow content.

## Decision

**Port the design, not the code.** Four primitives, reimplemented natively in
Seal's stack, exposed through OpenAPI/MCP per ADR-003:

1. **Provider layer** (`apps/api/src/platform/llm`): a thin provider-agnostic
   model registry (`provider/model` ids). First providers: Anthropic direct and
   the Devin subscription via the Codeium-protocol adapter. Model calls run in
   a Durable Object or queue-driven worker, not the request lifecycle — legal
   review streams run minutes, not milliseconds.
2. **Review matrix** (tabular review): `review_matrices` / `review_rows` /
   `review_cells` tables. A cell is `{summary, flag, reasoning, citations[]}`.
   Generation streams cell updates; every cell must cite `documentId + page +
   quote` or report `not_found`. No uncited cells.
3. **Citation grounding**: anchors `{documentId, page, quote, bbox}` — the
   bbox comes free from pdf-inspector's layout pass, which Mike cannot do.
   Citations are validated against `parsedText` before display.
4. **Revision suggestions** (the edit primitive, reshaped): rather than Mike's
   docx `w:ins`/`w:del` engine, model-native `revision_suggestions` —
   anchored delete/insert operations over the parsed document, with a
   pending/accepted/rejected lifecycle producing a new derived document
   (`parentDocumentId`) that re-runs convert → parse. Optional docx redline
   export for counterparty negotiation remains a follow-up.

Workflow packs (the 141 SKILL.md corpus) are content, not code: evaluated
separately for licensing, then authored as Vortex-specific playbooks regardless
— our playbook corpus (our NDA positions, our fallback terms) is the durable
asset.

Meanwhile, the running Mike instance stays as the reference implementation and
a callable review service behind the network boundary — that keeps AGPL
quarantined while the native primitives land.

## Consequences

- Seal gains a legal-review surface that operates on *its own* document graph —
  execution status, counterparty history, fields, and audit — which Mike can
  never see.
- The AGPL posture stays clean: zero copied code, one optional service call.
- The open question is provider economics: which model tier is the default for
  routine review vs. escalation.
- Risk: the docx tracked-changes engine is the deepest piece of Mike. The
  reshaped `revision_suggestions` design is deliberately simpler and fits
  Seal's execution-first flow; if counterparties need Word redlines back, that
  capability gets scoped as its own workstream.
