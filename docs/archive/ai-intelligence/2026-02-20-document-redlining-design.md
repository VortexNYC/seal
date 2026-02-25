---
date: 2026-02-20
topic: document-redlining
---

# Document Redlining Design

## What We're Building

AI-powered document redlining that highlights key clauses, obligations, payment terms, risk areas, and important dates directly on the PDF. Runs automatically as part of the existing document processing pipeline — no manual trigger needed. Annotations are visible only to the document sender/owner.

## Why This Approach

Single combined Gemini call extracts both field suggestions AND annotations in one pass. The pipeline fans out the result into separate tables. This is cheaper (one PDF upload to Gemini instead of two), faster, and conceptually clean: "analyze this document" is one operation that returns all intelligence.

## Key Decisions

- **Trigger**: Auto-pipeline alongside field analysis — zero friction
- **Gemini calls**: Single combined call returns fields + annotations
- **Visibility**: Sender/owner only — recipients never see annotations
- **Categories**: All 5 (obligations, payment, risk, dates, terms)
- **PDF highlights**: Only important + critical severity — soft pastel colors
- **Informational annotations**: Sidebar list only, not highlighted on PDF
- **Sidebar UI**: "Insights" section in existing right sidebar
- **No recipient-facing annotations**
- **No per-annotation dismiss** — master toggle only

## Architecture

### Data Pipeline

1. **Ingest** — document uploaded (Convex storage, stable `storageId`)
2. **Extract** — single Gemini call returns `{ fields[], annotations[] }` (ActionCache keyed on `storageId`)
3. **Fan out** — pipeline writes to `ai_field_suggestions` (existing) and `ai_document_annotations` (new)
4. **Downstream** — payment extraction triggers for payment fields (existing)

### Data Model

New table: `ai_document_annotations`

```
documentId:       Id<"documents">
organizationId:   Id<"organizations">
annotations: [
  {
    page:         number                    // 1-indexed
    x:            number                    // percentage (0-100)
    y:            number                    // percentage (0-100)
    width:        number                    // percentage (0-100)
    height:       number                    // percentage (0-100)
    category:     "obligation" | "payment" | "risk" | "dates" | "terms"
    severity:     "informational" | "important" | "critical"
    text:         string                    // extracted clause text
    summary:      string                    // plain-English explanation
  }
]
modelUsed:        string
tokensUsed:       number
processingTimeMs: number
status:           "pending" | "active" | "dismissed"
createdAt:        number
```

Indexes: `by_document`, `by_organization`. Same pattern as `ai_field_suggestions`.

### Gemini Integration

Extend existing `analyzeFieldsInternal` action:
- Expand Zod schema to include `annotations[]` alongside `fields[]`
- Expand prompt to request clause annotation with category, severity, bounding box, text, and summary
- `FieldAnalysisResult` type gains optional `annotations` array
- ActionCache unchanged — same `storageId` key, same 24h TTL

### Pipeline Changes

`processDocument` gains one new step after saving field suggestions:
- Call `saveDocumentAnnotations` mutation with the annotations from the combined result
- On PDF replace: dismiss existing annotations before saving new ones

### Frontend

**PDF overlays** (inside TransformComponent):
- Soft pastel semi-transparent highlight behind annotated text regions
- Only `important` and `critical` severity shown on PDF
- Muted colors: soft blue (obligations), soft green (payment), soft rose (risk), soft violet (dates), soft amber (terms)
- Hover → small floating tooltip with one-line summary

**Sidebar "Insights" panel** (right sidebar, collapsible section):
- Flat list of ALL annotations (including informational)
- Each row: colored severity dot + summary text + page number chip
- Click → jump to page, annotation pulses once
- Filter chips at top to toggle categories
- Count badge on section header
- Master toggle to hide/show all highlights on PDF

**Not building:**
- Category grouping/headers in sidebar
- Annotation editing or commenting
- Per-annotation dismiss
- Recipient-facing annotations
- Configurable categories

## Open Questions

- Cached documents from before this change won't have annotations until cache expires (24h) or PDF is re-uploaded. Acceptable for now.
