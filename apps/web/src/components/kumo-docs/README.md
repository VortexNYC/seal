# Kumo Docs — Seal-owned Extend surface

Rebuild of Extend UI capabilities on `@cloudflare/kumo` + Seal Taupe tokens.
**Never** `pnpm add @extend/*`. Extend is reference only (SEA-26).

| Extend | Seal (`kumo-docs`) | Status |
| --- | --- | --- |
| PDF Viewer | existing `documents/pdf-*` + `DocumentViewerShell` | shell |
| Document Viewer Sidebar | `ThumbnailSidebar` | ship |
| Bounding Box Citations | `CitationReviewPanel` | ship |
| Document Splits | `DocumentSplitsPanel` | ship |
| Schema Builder | `BindingsPanel` (`binding_key`) | ship |
| E-Signature | existing `signature-capture` | keep |
| File Upload / Thumbnail | existing upload + thumbnail | keep |
| CSV / Office preview | `PreviewPane` | ship |
| PDF/DOCX/XLSX editors | out of scope | — |
