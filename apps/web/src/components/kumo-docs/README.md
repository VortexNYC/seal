# Kumo Docs — Seal-owned Extend surface

Every Extend UI catalog component, rebuilt on EmbedPDF / Kumo / Seal Taupe.
**Never** `pnpm add @extend/*`. Extend is reference only (SEA-26).

Agents and humans share the same **PDF toolkit** capabilities. Seal is an
agreement-document platform (convert → PDF → review / mark up / fields / sign),
not a Word/Excel editor and not only e-sign.

| Extend | Seal (`kumo-docs`) | Human workflow | Agent tool |
| --- | --- | --- | --- |
| PDF Viewer | `PdfViewer` / signing surface (PDFium) | Document detail + **public sign** | preview |
| PDF Editor | `PdfEditor` / `DocumentCanvas` (EmbedPDF) | Document Workspace **Mark up** | `seal_annotate_document_pdf`, `seal_replace_document_pdf` |
| DOCX Viewer | `DocxViewer` | Original preview (read-only) | preview original |
| Layout Blocks | `LayoutBlocksPanel` | Document Workspace **Layout** | `seal_get_document_layout_blocks` |
| Excel Viewer | `XlsxViewer` | Original preview (read-only) | preview |
| PowerPoint Viewer | `PptxViewer` | Original preview (PDF slide rasters) | preview |
| CSV Viewer | `CsvViewer` | Original preview (read-only) | preview |
| File Upload | `FileUpload` | Upload dialog → convert to PDF | upload tools |
| File System (Finder) | `FileSystem` | Documents **Finder** view | folder/list tools |
| Bounding Box Citations | `CitationReviewPanel` | Document sidebar | annotation tools |
| Schema Builder | `SchemaBuilderPanel` | Document Workspace **Layout** | `seal_*_extraction_schema` |
| File Thumbnail | `FileThumbnail` | Documents list/grid + Finder icons | — |
| E-Signature | `ESignature` | Signature capture | signature tools |
| Document Splits | `DocumentSplitsPanel` | Document Workspace **Pages** | `seal_split_document` |
| PDF ops (rotate/merge) | `DocumentPdfOpsPanel` | Document Workspace **Pages** | `seal_rotate_document_pdf`, `seal_merge_documents_pdf` |
| Document Viewer Sidebar | `ThumbnailSidebar` + shell | Document detail | — |

## Document Workspace (draft PDF)

- **Fields** — signature / form field placement on the shared canvas
- **Mark up** — annotate / redact → Save to Seal
- **Pages** — rotate / merge / split (docked under the live PDF)
- **Layout** — layout blocks + extraction schema (docked under the live PDF)

Office/CSV uploads convert to PDF at intake. There is no in-app Word/Excel
editor — fix the source outside Seal, or mark up / replace the PDF here.

PDF engine policy: EmbedPDF/PDFium for product PDF surfaces. Konva stays for
Seal signature-field interaction.
