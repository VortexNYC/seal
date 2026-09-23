# Kumo Docs — Seal-owned Extend surface

Every Extend UI catalog component, rebuilt on EmbedPDF / Kumo / Seal Taupe.
**Never** `pnpm add @extend/*`. Extend is reference only (SEA-26).

Agents and humans share the same capabilities. Seal is a document platform
(contracts + PDFs + office files), not only e-sign.

| Extend | Seal (`kumo-docs`) | Human workflow | Agent tool |
| --- | --- | --- | --- |
| PDF Viewer | `PdfViewer` / signing surface (PDFium) | Document detail + **public sign** | preview |
| PDF Editor | `PdfEditor` (EmbedPDF) | Document detail **PDF tools** (default) | `seal_annotate_document_pdf`, `seal_replace_document_pdf`, `seal_rotate_document_pdf`, `seal_merge_documents_pdf` |
| DOCX Viewer | `DocxViewer` | Original preview | preview original |
| DOCX Editor | `DocxEditor` | Document detail **Edit original** → real `.docx` + reconvert | `seal_replace_document_original` |
| Layout Blocks | `LayoutBlocksPanel` | Document detail **Structure** (anydoc candidates + annotations) | `seal_get_document_layout_blocks` |
| Excel Viewer | `XlsxViewer` | Original preview | preview |
| Excel Editor | `XlsxEditor` | Document detail **Edit original** | `seal_replace_document_original` |
| PowerPoint Viewer | `PptxViewer` | Original preview (PDF slide rasters) | preview |
| CSV Viewer | `CsvViewer` | Original preview / **Edit original** (editable + save) | `seal_replace_document_original` |
| File Upload | `FileUpload` | Upload dialog | upload tools |
| File System (Finder) | `FileSystem` | Documents **Finder** view | folder/list tools |
| Bounding Box Citations | `CitationReviewPanel` | Document sidebar | annotation tools |
| Schema Builder | `SchemaBuilderPanel` | Document detail **Structure** | `seal_*_extraction_schema` |
| File Thumbnail | `FileThumbnail` | Documents list/grid + Finder icons | — |
| E-Signature | `ESignature` | Signature capture | signature tools |
| Document Splits | `DocumentSplitsPanel` | Document sidebar **Splits** | `seal_split_document` |
| PDF ops (rotate/merge) | `DocumentPdfOpsPanel` | Document sidebar **PDF ops** | `seal_rotate_document_pdf`, `seal_merge_documents_pdf` |
| Document Viewer Sidebar | `ThumbnailSidebar` + shell | Document detail | — |

## Product modes (draft documents)

- **PDF tools** (default) — EmbedPDF annotate / redact / forms / signatures / page organize / export → Save to Seal
- **Fields** — signature field placement (PDFium page raster + Konva e-sign canvas)
- **Edit original** — DOCX/XLSX/CSV editors (real OpenXML/CSV write-back + reconvert)
- **Structure** — anydoc field candidates + annotation layout blocks + extraction schema

PDF engine policy: EmbedPDF/PDFium for all product PDF surfaces (viewer, editor,
Fields, Sign, thumbnails/upload metadata). Konva stays for Seal signature-field
interaction. react-pdf / pdf.js are not used in the product app.
