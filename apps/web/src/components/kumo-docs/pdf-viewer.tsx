import type { JSX, ReactNode } from "react";
import { PDFViewer } from "@embedpdf/react-pdf-viewer";

import { cn } from "@/lib/utils";

export type PdfViewerProps = {
  /** Object URL or remote URL for the PDF */
  src: string | null;
  className?: string;
  height?: string | number;
  /** Optional absolute overlay (field markers, layout highlights). */
  overlay?: ReactNode;
};

/**
 * PDF viewer — Extend pdf-viewer depth via EmbedPDF (same engine as PdfEditor).
 * Read/browse surface; use PdfEditor when Save-to-Seal is required.
 */
export function PdfViewer({
  src,
  className,
  height = "32rem",
  overlay,
}: PdfViewerProps): JSX.Element {
  if (!src) {
    return (
      <div
        data-kumo-docs="pdf-viewer"
        className={cn(
          "text-muted-foreground flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed text-sm",
          className
        )}
      >
        No PDF loaded
      </div>
    );
  }

  return (
    <div
      data-kumo-docs="pdf-viewer"
      className={cn("relative overflow-hidden rounded-xl border", className)}
    >
      <PDFViewer
        style={{ width: "100%", height }}
        config={{
          src,
          theme: { preference: "system" },
          tabBar: "never",
          fonts: { ui: null, signature: null },
        }}
      />
      {overlay}
    </div>
  );
}
