# Kumo Docs — Seal-owned Extend surface

Every Extend UI catalog component, rebuilt on EmbedPDF / Kumo / Seal Taupe.
**Never** `pnpm add @extend/*`. Extend is reference only (SEA-26).

Agents and humans share the same capabilities. Seal is a document platform
(contracts + PDFs + office files), not only e-sign.

| Extend | Seal (`kumo-docs`) | Human workflow | Agent tool |
| --- | --- | --- | --- |
| PDF Viewer | `PdfViewer` (EmbedPDF) | Document detail (read) | preview |
| PDF Editor | `PdfEditor` (EmbedPDF) | Document detail **PDF tools** (default) | `seal_annotate_document_pdf`, `seal_replace_document_pdf`, `seal_rotate_document_pdf`, `seal_merge_documents_pdf` |
| DOCX Viewer | `DocxViewer` | Original preview | preview original |
| DOCX Editor | `DocxEditor` | Document detail **Edit original** | `seal_replace_document_original` |
| Excel Viewer | `XlsxViewer` | Original preview | preview |
| Excel Editor | `XlsxEditor` | Document detail **Edit original** | `seal_replace_document_original` |
| PowerPoint Viewer | `PptxViewer` | Original preview (PDF slide rasters) | preview |
| CSV Viewer | `CsvViewer` | Original preview / Edit original | preview |
| File Upload | `FileUpload` | Upload dialog | upload tools |
| File System (Finder) | `FileSystem` | Documents **Finder** view | folder/list tools |
| Bounding Box Citations | `CitationReviewPanel` | Document sidebar | annotation tools |
| Schema Builder | `SchemaBuilderPanel` | Document detail **Structure** | `seal_*_extraction_schema` |
| File Thumbnail | `FileThumbnail` | Documents list/grid + Finder icons | — |
| Layout Blocks | `LayoutBlocksPanel` + overlay | Document detail **Structure** | `seal_get_document_layout_blocks` |
| E-Signature | `ESignature` | Signature capture | signature tools |
| Document Splits | `DocumentSplitsPanel` | Document sidebar | `seal_split_document` |
| Document Viewer Sidebar | `ThumbnailSidebar` + shell | Document detail | — |

## Product modes (draft documents)

- **PDF tools** (default) — EmbedPDF annotate / redact / forms / signatures / page organize / export → Save to Seal
- **Fields** — signature field placement (e-sign canvas)
- **Edit original** — DOCX/XLSX/CSV editors (persist + reconvert when possible)
- **Structure** — layout blocks + extraction schema builder
