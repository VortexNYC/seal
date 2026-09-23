/** Seal-owned Extend capability surface — never import @extend/*. */

export { BindingsPanel, type BindingRow } from "./bindings-panel";
export {
  CitationReviewPanel,
  type CitationBBox,
  type CitationField,
} from "./citation-review-panel";
export { CsvViewer, type CsvViewerProps } from "./csv-viewer";
export { DocumentViewerShell } from "./document-viewer-shell";
export {
  DocumentSplitsPanel,
  createInitialSplits,
  type DocumentSplitGroup,
} from "./document-splits-panel";
export {
  DocumentPdfOpsPanel,
  type DocumentPdfOpsPanelProps,
} from "./document-pdf-ops-panel";
export { DocxEditor, type DocxEditorProps } from "./docx-editor";
export { DocxViewer, type DocxViewerProps } from "./docx-viewer";
export {
  ESignature,
  type ESignatureFont,
  type ESignatureMethod,
  type ESignatureProps,
  type ESignatureResult,
} from "./e-signature";
export {
  FileSystem,
  type FileSystemFileItem,
  type FileSystemFolderItem,
  type FileSystemItem,
  type FileSystemProps,
  type FileSystemView,
} from "./file-system";
export {
  FileThumbnail,
  FileThumbnailLoadingOverlay,
  type FileThumbnailProps,
  type ThumbnailFile,
} from "./file-thumbnail";
export {
  FileUpload,
  type FileUploadItem,
  type FileUploadProps,
} from "./file-upload";
export {
  LayoutBlockOverlay,
  LayoutBlocksPanel,
  type LayoutBlock,
  type LayoutBlockOverlayProps,
  type LayoutBlockType,
  type LayoutBlocksPanelProps,
} from "./layout-blocks";
export {
  PdfEditor,
  type PdfAnnotateOp,
  type PdfEditorProps,
} from "./pdf-editor";
export { PdfViewer, type PdfViewerProps } from "./pdf-viewer";
export {
  PreviewPane,
  type PreviewFormat,
} from "./preview-pane";
export { PptxViewer, type PptxSlide, type PptxViewerProps } from "./pptx-viewer";
export {
  SchemaBuilderPanel,
  serializeSchema,
  type SchemaBuilderFieldType,
  type SchemaBuilderProperty,
  type SchemaBuilderProps,
  type SchemaBuilderScalarType,
  type SchemaBuilderSchema,
} from "./schema-builder";
export {
  ThumbnailSidebar,
  type ThumbnailPage,
} from "./thumbnail-sidebar";
export {
  XlsxEditor,
  type XlsxEditorProps,
} from "./xlsx-editor";
export {
  XlsxViewer,
  type XlsxSheet,
  type XlsxViewerProps,
} from "./xlsx-viewer";
