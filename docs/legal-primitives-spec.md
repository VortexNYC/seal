# Legal review primitives — port spec (Mike → Seal)

**Status:** active spec · **Decision:** ADR-006 · **Source reference:** local
`mike` deployment (open-legal-products/mike, AGPL-3.0) — design reference only;
zero copied code.

This spec maps each Mike capability onto Seal's actual stack. The headline
finding from reading both codebases: **Seal's ingestion layer is already
better than Mike's.** The port surface is the review/runtime layer, not the
pipeline.

---

## 0. What Seal already owns (do not port)

| Capability | Seal today | Mike equivalent | Verdict |
|---|---|---|---|
| Format ingestion | `apps/anydoc-worker`: `@firecrawl/anydoc-wasm` → markdown | LibreOffice → PDF + pdfjs text | **Seal wins** — markdown native, more formats |
| PDF analysis | `@firecrawl/pdf-inspector-wasm`: pdfType, `pagesNeedingOcr`, per-page layout | pdfjs text only | **Seal wins** — OCR detection + layout bboxes |
| Office conversion | `apps/convert-worker` (containerized) | LibreOffice sidecar | Equivalent |
| Doc storage/versioning | R2 `storageKey`, `parentDocumentId` lineage | RustFS + `document_versions` | Equivalent, Seal's lineage model is simpler |
| Field extraction | `fieldCandidates`, `extractFieldCandidates` | — | Seal already ahead |
| Agent surface | MCP worker (21+ tools) mirroring OpenAPI | REST only | **Seal wins** |

**Nothing in the ingestion column gets ported.** Mike's `upload-sessions` +
staging flow exists because its frontend needs presigned PUTs; Seal already has
that story.

## 1. The actual gaps

| # | Primitive | Mike reference | Seal today |
|---|---|---|---|
| 1 | Model provider layer | `lib/llm/providers.ts` | **Nothing** — `aiFieldSuggestions.modelUsed` exists as an audit column with nothing writing it |
| 2 | Review matrix (tabular extraction) | `modules/tabular` | Nothing |
| 3 | Citation grounding | `[[doc\|\|page\|\|quote]]` + CourtListener | Nothing — but pdf-inspector layout enables bbox anchors Mike lacks |
| 4 | Revision suggestions / redlines | `edit_document` + `document_edits` + tracked-changes docx | Nothing |
| 5 | Workflow/playbook packs | 141 SKILL.md corpus (`mike-workflows` repo) | Nothing |

---

## 2. Primitive specs

### 2.1 Provider layer — `apps/api/src/platform/llm/`

Model calls keyed `provider/model`. Streaming, minutes-long runs → execute in
a **Durable Object** (or Cloudflare Workflows run), never the request lifecycle.

```ts
interface ModelProvider {
  stream(req: ChatRequest): AsyncIterable<StreamPart>; // text|tool-call|finish
}
// registry: { "anthropic/*": anthropicProvider, "devin/*": devinProvider, "cf/*": workersAI }
```

- Candidate providers: Anthropic direct (zero-retention terms — right default
  for legal docs), Workers AI (`@cf/*`, zero egress, weaker models), Devin
  subscription via the Codeium adapter (proven working in Mike; *unofficial —
  pin it behind a provider flag so a breakage is a config swap, not an
  incident*).
- Hard-won bug worth carrying forward: the Devin adapter emits
  `finishReason` as a bare string; V3 consumers need `{unified, raw}` or the
  tool loop silently drops tool calls. Whatever provider SDK lands here needs
  the same normalization check.
- Org-level model selection + audit: reuse the `modelUsed`/`tokensUsed`/
  `processingTimeMs` columns already on the AI tables.

### 2.2 Review matrix — `review_matrices`, `review_rows`, `review_cells`

```
review_matrices: id, publicId, organizationId, ownerId, title, model, status,
                 columnsConfig (jsonb [{index,name,prompt}]), createdAt…
review_rows:     id, matrixId, documentId → documents.id
review_cells:    id, rowId, columnIndex, status (pending|generating|done|error),
                 summary, flag (green|amber|red|grey), reasoning, citations (jsonb)
```

- Generation: queue-driven; each cell is a bounded model call against one
  document's `parsedText` (+ layout for page anchoring). SSE endpoint streams
  `cell_update` events; also pollable.
- **Contract:** every `done` cell carries ≥1 citation or the literal
  `not_found`. Cells that can't be grounded must not invent. (Mike gets this
  right — observed real `Not Found` cells — and it's the property that makes
  the output trustworthy for legal.)
- OpenAPI-first per ADR-003: `POST /reviews`, `GET /reviews/:id`,
  `POST /reviews/:id/generate`; MCP tools mirror.

### 2.3 Citation grounding

Anchor shape: `{documentId, page, quote, bbox?}`.

- Validation pass before display: `quote` must appear in `parsedText` (or the
  page's extracted text); `page`/`bbox` come from pdf-inspector layout —
  better than Mike, which only carries page+quote.
- CourtListener verification (case-law cite checks) is a separate optional
  integration — worth it, cheap API, prevents hallucinated-cite disasters.
- MCP: expose `documents.read` returning `{page, bbox}`-anchored chunks so
  agents can produce citations natively instead of us post-hoc parsing them.

### 2.4 Revision suggestions — `revision_suggestions`

Mike's literal design (docx `w:ins`/`w:del` surgery) is the right *idea* for
counterparty redlines but the wrong substrate for Seal, whose canonical doc is
the converted artifact + `parsedText`.

```
revision_suggestions: id, publicId, documentId, organizationId, createdByMessageId,
                      anchor (page/bbox/context quote), deletedText, insertedText,
                      status (pending|accepted|rejected), resolvedAt
```

- Apply = materialize a new derived document via `parentDocumentId`, re-run
  convert → parse → field-candidate extraction. The suggestion lifecycle is
  the same pending/accept/reject flow Mike proved; the substrate is
  Seal-native.
- **Follow-up (scoped separately):** true `.docx` tracked-changes export for
  inbound counterparty negotiation — send-back redlines. That's where Mike's
  `applyTrackedEdits` is genuinely deep; if needed, the docx-edit engine is a
  candidate for clean-room reimplementation or a licensed component.

### 2.5 Playbook packs

The 141-workflow corpus is **content** (SKILL.md instruction packs), synced
from a separate `mike-workflows` repo — check its license independently of
Mike's. Regardless of license, the durable asset is Vortex-authored playbooks:
our standard NDA positions, contractor terms, fallback language. Format
(SKILL.md + optional assets) is a convention, not copyable code.

---

## 3. Phasing

| Phase | Deliverable | Notes |
|---|---|---|
| 0 | Mike stays running locally as reference + callable review service | AGPL quarantined behind the network boundary |
| 1 | Provider layer + first model call (review a doc's parsedText) | Unblocks everything below |
| 2 | Review matrix (tables + generate + MCP tool) | Highest-value primitive, simplest port |
| 3 | Citation validation pass | Makes matrix + chat output trustworthy |
| 4 | Revision suggestions lifecycle | New doc version on accept |
| 5 | Playbook format + first Vortex packs | Content workstream, parallelizable |
| 6 | (Optional) docx tracked-changes engine | Only if counterparty redline round-trips matter |

## 4. Open questions

1. **Provider default for legal work** — Anthropic zero-retention vs. Devin
   subscription (cost: ~free-ish vs. paid API) vs. Workers AI (egress-free,
   weakest). Probably: Devin for routine, Anthropic for escalation.
2. **OCR execution** — Seal *detects* `pagesNeedingOcr` but nothing OCRs them.
   Scanned counterparty contracts are common in the real world. Workers AI
   vision or an external OCR is the gap to close.
3. **mike-workflows license** — content license may differ from Mike's AGPL.
4. **Commercial Mike license?** — worth one email to open-legal-products if
   the docx engine gets scoped in phase 6.
