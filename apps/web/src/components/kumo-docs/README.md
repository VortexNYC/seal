# Kumo Docs — Seal-owned Extend surface

Rebuild of Extend UI capabilities on `@cloudflare/kumo` + Seal Taupe tokens.
**Never** `pnpm add @extend/*`. Extend is reference only (SEA-26).

| Extend | Seal (`kumo-docs`) | Status |
| --- | --- | --- |
| PDF Viewer | existing `documents/pdf-*` + `DocumentViewerShell` | wired |
| Document Viewer Sidebar | `ThumbnailSidebar` | wired |
| Bounding Box Citations | `CitationReviewPanel` | wired |
| Document Splits | `DocumentSplitsPanel` | wired |
| Schema Builder | `BindingsPanel` (`binding_key`) | wired |
| E-Signature | existing `signature-capture` | keep |
| File Upload / Thumbnail | existing upload + thumbnail | keep |
| CSV / Office preview | `PreviewPane` | wired |
| PDF/DOCX/XLSX editors | out of scope | — |
