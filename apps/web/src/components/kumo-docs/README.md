# Kumo Docs — Seal-owned Extend surface

Every Extend UI catalog component, rebuilt on `@cloudflare/kumo` + Seal Taupe.
**Never** `pnpm add @extend/*`. Extend is reference only (SEA-26).

| Extend | Seal (`kumo-docs`) | Status |
| --- | --- | --- |
| PDF Viewer | `PdfViewer` + existing pdf canvas | done |
| PDF Editor | `PdfEditor` (annotate ops) | done — catalog; product field placement stays on canvas |
| DOCX Viewer | `DocxViewer` (mammoth) | done — wired into original preview |
| DOCX Editor | `DocxEditor` | done |
| Excel Viewer | `XlsxViewer` (sheetjs) | done — wired into original preview |
| Excel Editor | `XlsxEditor` | done |
| PowerPoint Viewer | `PptxViewer` | done — preview shows download until slide convert |
| CSV Viewer | `CsvViewer` | done — wired into `PreviewPane` |
| File Upload | `FileUpload` | done — wired into `UploadDialog` |
| File System (Finder) | `FileSystem` | done |
| Bounding Box Citations | `CitationReviewPanel` | done |
| Schema Builder | `SchemaBuilderPanel` + `BindingsPanel` | done |
| File Thumbnail | `FileThumbnail` | done |
| Layout Blocks | `LayoutBlocksPanel` + `LayoutBlockOverlay` | done |
| E-Signature | `ESignature` | done — wired into `SignatureCapture` |
| Document Splits | `DocumentSplitsPanel` | done |
| Document Viewer Sidebar | `ThumbnailSidebar` + `DocumentViewerShell` | done |

## Product adoption

| Surface | Status |
| --- | --- |
| Citations / splits / bindings / thumbnails / shell | live in document routes |
| Upload dialog | uses `FileUpload` |
| Signature capture | uses `ESignature` (+ saved library shell) |
| Original preview (CSV / DOCX / XLSX) | uses `CsvViewer` / `DocxViewer` / `XlsxViewer` via power preview |
| PPTX slide images / PDF annotate editor mode | catalog ready — convert pipeline / annotate mode next |
