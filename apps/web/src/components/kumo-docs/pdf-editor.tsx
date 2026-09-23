import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { Button } from "@cloudflare/kumo/components/button";

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

type ExportCapability = {
  saveAsCopyAndGetBufferAndName?: (documentId: string) => {
    toPromise: () => Promise<{ buffer: ArrayBuffer; name: string }>;
  };
};

type DocumentManagerCapability = {
  getActiveDocumentId?: () => string | null;
};

/**
 * PDF editor — Extend pdf-editor depth via EmbedPDF (same engine Extend uses).
 * Kumo/Taupe chrome; never @extend/*.
 */
export function PdfEditor({
  src,
  className,
  author: _author = "Seal",
  onSave,
  saving = false,
}: PdfEditorProps): JSX.Element {
  const viewerRef = useRef<PDFViewerRef>(null);
  const [ready, setReady] = useState(false);
  const registryRef = useRef<unknown>(null);

  const handleSave = useCallback(async () => {
    if (!onSave || !registryRef.current) return;
    const registry = registryRef.current as {
      getPlugin?: (id: string) => { provides?: () => unknown } | undefined;
    };
    const exportPlugin = registry.getPlugin?.("export");
    const documentManager = registry.getPlugin?.("document-manager");
    const exportCap = exportPlugin?.provides?.() as ExportCapability | undefined;
    const docsCap = documentManager?.provides?.() as
      | DocumentManagerCapability
      | undefined;
    const documentId = docsCap?.getActiveDocumentId?.();
    if (!exportCap?.saveAsCopyAndGetBufferAndName || !documentId) {
      throw new Error("EmbedPDF export is not ready");
    }
    const result = await exportCap
      .saveAsCopyAndGetBufferAndName(documentId)
      .toPromise();
    await onSave(result.buffer);
  }, [onSave]);

  if (!src) {
    return (
      <div
        data-kumo-docs="pdf-editor"
        className={cn(
          "text-muted-foreground flex min-h-[32rem] items-center justify-center rounded-xl border border-dashed text-sm",
          className
        )}
      >
        No PDF loaded
      </div>
    );
  }

  return (
    <div
      data-kumo-docs="pdf-editor"
      className={cn("flex flex-col gap-2", className)}
    >
      {onSave ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!ready || saving}
            onClick={() => {
              void handleSave().catch(() => {
                /* toast owned by parent */
              });
            }}
          >
            {saving ? "Saving to Seal…" : "Save to Seal"}
          </Button>
        </div>
      ) : null}
      <div className="border-border bg-card min-h-[36rem] overflow-hidden rounded-xl border">
        <PDFViewer
          ref={viewerRef}
          style={{ width: "100%", height: "36rem" }}
          config={{
            src,
            theme: { preference: "system" },
            tabBar: "never",
            fonts: { ui: null, signature: null },
          }}
          onReady={(registry) => {
            registryRef.current = registry;
            setReady(true);
          }}
        />
      </div>
      <p className="text-muted-foreground text-[11px]">
        Full EmbedPDF surface — annotate, redact, forms, signatures, page
        organize, export. Save writes the edited PDF back into Seal storage.
      </p>
    </div>
  );
}
