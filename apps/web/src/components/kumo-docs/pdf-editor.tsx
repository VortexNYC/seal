import type { JSX } from "react";
import { useState } from "react";

import { DocumentCanvas } from "@/components/documents/document-canvas";
import { cn } from "@/lib/utils";

/** Kept for agent power/annotate op lists (MCP / session annotate API). */
export type PdfAnnotateOp =
  | {
      op: "text";
      page: number;
      x: number;
      y: number;
      text: string;
      size?: number;
      color?: string;
    }
  | {
      op: "highlight";
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
    }
  | {
      op: "rect";
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
    }
  | {
      op: "redact";
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };

export type PdfEditorProps = {
  /** Object URL or remote URL for the PDF */
  src: string | null;
  className?: string;
  author?: string;
  /** Persist edited PDF bytes back to Seal. */
  onSave?: (buffer: ArrayBuffer) => void | Promise<void>;
  saving?: boolean;
};

/**
 * PDF editor — EmbedPDF annotate via shared DocumentCanvas.
 * Kumo/Taupe chrome; never @extend/*.
 */
export function PdfEditor({
  src,
  className,
  author: _author = "Seal",
  onSave,
  saving = false,
}: PdfEditorProps): JSX.Element {
  const [currentPage, setCurrentPage] = useState(1);

  if (!src) {
    return (
      <div
        data-kumo-docs="pdf-editor"
        className={cn(
          "text-muted-foreground flex min-h-128 items-center justify-center rounded-xl border border-dashed text-sm",
          className
        )}
      >
        No PDF loaded
      </div>
    );
  }

  return (
    <div data-kumo-docs="pdf-editor" className={cn(className)}>
      <DocumentCanvas
        src={src}
        interaction="markup"
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onSaveMarkup={onSave}
        savingMarkup={saving}
      />
    </div>
  );
}
