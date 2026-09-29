import type { FormEvent, JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

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

type ScrollCapability = {
  getCurrentPage?: () => number;
  getTotalPages?: () => number;
  scrollToPage?: (options: { pageNumber: number }) => void;
  onPageChange?: {
    on: (listener: (event: { pageNumber: number; totalPages: number }) => void) => () => void;
  };
};

type PluginRegistryLike = {
  getPlugin?: (id: string) => { provides?: () => unknown } | undefined;
};

function getScrollCapability(registry: unknown): ScrollCapability | null {
  if (!registry || typeof registry !== "object") {
    return null;
  }
  const plugin = (registry as PluginRegistryLike).getPlugin?.("scroll");
  const provided = plugin?.provides?.();
  if (!provided || typeof provided !== "object") {
    return null;
  }
  return provided as ScrollCapability;
}

/**
 * PDF editor — Extend pdf-editor depth via EmbedPDF (same engine Extend uses).
 * Kumo/Taupe chrome; never @extend/*.
 *
 * EmbedPDF's built-in Previous/Next page controls desync after jump-to-page
 * (Prev from mid-doc jumps to page 1). Seal owns page nav via ScrollCapability.scrollToPage.
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleReady = useCallback((registry: unknown) => {
    registryRef.current = registry;
    setReady(true);
    const scroll = getScrollCapability(registry);
    if (!scroll) {
      return;
    }
    const initialPage = scroll.getCurrentPage?.() ?? 1;
    const initialTotal = scroll.getTotalPages?.() ?? 1;
    setCurrentPage(initialPage);
    setTotalPages(Math.max(1, initialTotal));
  }, []);

  // Keep page-change subscription for the life of the registry
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const scroll = getScrollCapability(registryRef.current);
    if (!scroll?.onPageChange) {
      return undefined;
    }
    return scroll.onPageChange.on((event) => {
      setCurrentPage(event.pageNumber);
      setTotalPages(Math.max(1, event.totalPages));
    });
  }, [ready]);

  const goToPage = useCallback((page: number) => {
    const scroll = getScrollCapability(registryRef.current);
    if (!scroll?.scrollToPage) {
      return;
    }
    // Prefer live capability totals — closure totalPages can be stale (1) before
    // onPageChange fires, which previously clamped mid-doc jumps to page 1.
    const liveTotal = Math.max(
      1,
      scroll.getTotalPages?.() ?? totalPages,
      totalPages
    );
    if (liveTotal !== totalPages) {
      setTotalPages(liveTotal);
    }
    const clamped = Math.min(Math.max(1, page), liveTotal);
    scroll.scrollToPage({ pageNumber: clamped });
    setCurrentPage(clamped);
  }, [totalPages]);

  const handlePageInputSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const pageNum = Number.parseInt(pageInput, 10);
      if (!Number.isNaN(pageNum)) {
        goToPage(pageNum);
      } else {
        setPageInput(String(currentPage));
      }
    },
    [pageInput, goToPage, currentPage]
  );

  const handleSave = useCallback(async () => {
    if (!onSave || !registryRef.current) return;
    const registry = registryRef.current as PluginRegistryLike;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="bg-kumo-surface/95 flex items-center gap-1 rounded-lg border p-1.5 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Previous page"
            disabled={!ready || currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="size-8"
            icon={CaretLeft}
          />
          <form
            onSubmit={handlePageInputSubmit}
            className="flex items-center gap-1"
          >
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => {
                const pageNum = Number.parseInt(pageInput, 10);
                if (Number.isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
                  setPageInput(String(currentPage));
                }
              }}
              className="h-8 w-10 px-1 text-center text-sm"
              aria-label="Current page"
            />
            <span className="text-kumo-secondary text-sm whitespace-nowrap">
              / {totalPages}
            </span>
          </form>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Next page"
            disabled={!ready || currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            className="size-8"
            icon={CaretRight}
          />
        </div>
        {onSave ? (
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
        ) : null}
      </div>
      <div
        className={cn(
          "border-border bg-card min-h-[36rem] overflow-hidden rounded-xl border",
          // Hide EmbedPDF's built-in page pager — it desyncs after jump-to-page.
          "[&_button[aria-label='Previous Page']]:hidden",
          "[&_button[aria-label='Next Page']]:hidden",
          "[&_input[aria-label='Current page']]:hidden"
        )}
      >
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
            handleReady(registry);
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
