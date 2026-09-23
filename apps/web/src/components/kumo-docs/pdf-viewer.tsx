import type { JSX, ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { cn } from "@/lib/utils";

import { PdfViewerControls } from "@/components/documents/pdf-viewer-controls";

pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker;

export type PdfViewerProps = {
  file: string | File | ArrayBuffer | null;
  page: number;
  numPages: number | null;
  width?: number;
  className?: string;
  overlay?: ReactNode;
  onLoadSuccess?: (info: { numPages: number }) => void;
  onPageChange?: (page: number) => void;
  currentZoom?: number;
};

/**
 * PDF page viewer chrome — Extend pdf-viewer capability on react-pdf + Kumo.
 */
export function PdfViewer({
  file,
  page,
  numPages,
  width = 700,
  className,
  overlay,
  onLoadSuccess,
  onPageChange,
  currentZoom = 1,
}: PdfViewerProps): JSX.Element {
  return (
    <div
      data-kumo-docs="pdf-viewer"
      className={cn("flex flex-col gap-3", className)}
    >
      {onPageChange ? (
        <PdfViewerControls
          currentZoom={currentZoom}
          currentPage={page}
          totalPages={numPages ?? 1}
          onPageChange={onPageChange}
          enableKeyboardShortcuts
        />
      ) : null}
      <div className="border-border bg-card relative mx-auto overflow-hidden rounded-lg border shadow-sm">
        {file ? (
          <Document
            file={file}
            onLoadSuccess={onLoadSuccess}
            loading={
              <div className="text-muted-foreground p-16 text-center text-sm">
                Loading PDF…
              </div>
            }
            error={
              <div className="text-destructive p-16 text-center text-sm">
                Failed to load PDF
              </div>
            }
          >
            <Page
              pageNumber={page}
              width={width}
              renderTextLayer
              renderAnnotationLayer
            />
          </Document>
        ) : (
          <div className="text-muted-foreground p-16 text-center text-sm">
            No PDF loaded
          </div>
        )}
        {overlay}
      </div>
    </div>
  );
}
