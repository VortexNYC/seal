import type {
  DragEvent,
  FormEvent,
  JSX,
  ReactNode,
  RefObject,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

import { PdfCanvasLayer } from "./pdf-canvas-layer";
import type { PlacedField } from "./draggable-field";

type PluginRegistryLike = {
  getPlugin?: (id: string) => { provides?: () => unknown } | undefined;
};

type ScrollCapability = {
  getCurrentPage?: () => number;
  getTotalPages?: () => number;
  scrollToPage?: (options: { pageNumber: number }) => void;
  getMetrics?: () => {
    currentPage: number;
    pageVisibilityMetrics: Array<{
      pageNumber: number;
      scaled: {
        pageX: number;
        pageY: number;
        visibleWidth: number;
        visibleHeight: number;
        scale: number;
      };
    }>;
  };
  getLayout?: () => {
    virtualItems: Array<{
      pageLayouts: Array<{
        pageNumber: number;
        width: number;
        height: number;
        rotatedWidth: number;
        rotatedHeight: number;
      }>;
    }>;
  };
  onPageChange?: (
    listener: (event: { pageNumber: number; totalPages: number }) => void
  ) => () => void;
  onScroll?: (listener: (event: { metrics: unknown }) => void) => () => void;
};

type ExportCapability = {
  saveAsCopyAndGetBufferAndName?: (documentId: string) => {
    toPromise: () => Promise<{ buffer: ArrayBuffer; name: string }>;
  };
};

type DocumentManagerCapability = {
  getActiveDocumentId?: () => string | null;
};

type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
};

function getScrollCapability(registry: unknown): ScrollCapability | null {
  if (!registry || typeof registry !== "object") return null;
  const plugin = (registry as PluginRegistryLike).getPlugin?.("scroll");
  const provided = plugin?.provides?.();
  if (!provided || typeof provided !== "object") return null;
  return provided as ScrollCapability;
}

function resolvePageBox(
  scroll: ScrollCapability,
  pageNumber: number
): PageBox | null {
  const metrics = scroll.getMetrics?.();
  const layout = scroll.getLayout?.();
  if (!metrics || !layout) return null;

  const visibility = metrics.pageVisibilityMetrics.find(
    (entry) => entry.pageNumber === pageNumber
  );
  let naturalWidth = 0;
  let naturalHeight = 0;
  for (const item of layout.virtualItems) {
    const page = item.pageLayouts.find((p) => p.pageNumber === pageNumber);
    if (page) {
      naturalWidth = page.rotatedWidth || page.width;
      naturalHeight = page.rotatedHeight || page.height;
      break;
    }
  }
  if (!visibility || naturalWidth <= 0 || naturalHeight <= 0) return null;

  const scale = visibility.scaled.scale || 1;
  return {
    x: visibility.scaled.pageX,
    y: visibility.scaled.pageY,
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    scale,
    naturalWidth,
    naturalHeight,
  };
}

export type DocumentCanvasProps = {
  src: string;
  /** Shared EmbedPDF surface — fields overlays; markup enables annotate chrome. */
  interaction: "fields" | "markup";
  className?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onDocumentMeta?: (meta: {
    numPages: number;
    pageWidth: number;
    pageHeight: number;
  }) => void;
  fields?: PlacedField[];
  selectedFieldId?: string | null;
  onFieldSelect?: (fieldId: string | null) => void;
  onFieldUpdate?: (
    fieldId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  onFieldDragOver?: (event: DragEvent) => void;
  onFieldDrop?: (event: DragEvent) => void;
  fieldContainerRef?: RefObject<HTMLDivElement | null>;
  fieldDragging?: boolean;
  fieldOverlayExtra?: ReactNode;
  onSaveMarkup?: (buffer: ArrayBuffer) => void | Promise<void>;
  savingMarkup?: boolean;
};

/**
 * One shared PDF canvas for Document Workspace.
 * Fields and Mark up keep the same EmbedPDF mount; only chrome + overlay change.
 */
export function DocumentCanvas({
  src,
  interaction,
  className,
  currentPage,
  onPageChange,
  onDocumentMeta,
  fields = [],
  selectedFieldId = null,
  onFieldSelect,
  onFieldUpdate,
  onFieldDragOver,
  onFieldDrop,
  fieldContainerRef,
  fieldDragging = false,
  fieldOverlayExtra = null,
  onSaveMarkup,
  savingMarkup = false,
}: DocumentCanvasProps): JSX.Element {
  const viewerRef = useRef<PDFViewerRef>(null);
  const registryRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [pageBox, setPageBox] = useState<PageBox | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const onDocumentMetaRef = useRef(onDocumentMeta);
  onPageChangeRef.current = onPageChange;
  onDocumentMetaRef.current = onDocumentMeta;

  const refreshPageBox = useCallback(
    (pageNumber: number) => {
      const scroll = getScrollCapability(registryRef.current);
      if (!scroll) return;
      const box = resolvePageBox(scroll, pageNumber);
      setPageBox(box);
      if (box) {
        onDocumentMetaRef.current?.({
          numPages: scroll.getTotalPages?.() ?? 1,
          pageWidth: box.width,
          pageHeight: box.height,
        });
      }
    },
    []
  );

  const handleReady = useCallback(
    (registry: unknown) => {
      registryRef.current = registry;
      setReady(true);
      const scroll = getScrollCapability(registry);
      if (!scroll) return;
      const page = scroll.getCurrentPage?.() ?? 1;
      const total = Math.max(1, scroll.getTotalPages?.() ?? 1);
      setTotalPages(total);
      onPageChangeRef.current(page);
      refreshPageBox(page);
    },
    [refreshPageBox]
  );

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!ready) return undefined;
    const scroll = getScrollCapability(registryRef.current);
    if (!scroll?.onPageChange) return undefined;
    return scroll.onPageChange((event) => {
      setTotalPages(Math.max(1, event.totalPages));
      onPageChangeRef.current(event.pageNumber);
      refreshPageBox(event.pageNumber);
    });
  }, [ready, refreshPageBox]);

  useEffect(() => {
    if (!ready) return undefined;
    const scroll = getScrollCapability(registryRef.current);
    if (!scroll?.onScroll) return undefined;
    return scroll.onScroll(() => {
      const page = scroll.getCurrentPage?.() ?? currentPage;
      refreshPageBox(page);
    });
  }, [ready, refreshPageBox, currentPage]);

  // Parent thumbnail / controls → EmbedPDF (same mount).
  useEffect(() => {
    if (!ready) return;
    const scroll = getScrollCapability(registryRef.current);
    const live = scroll?.getCurrentPage?.();
    if (!scroll?.scrollToPage || live === currentPage) return;
    scroll.scrollToPage({ pageNumber: currentPage });
    refreshPageBox(currentPage);
  }, [currentPage, ready, refreshPageBox]);

  const goToPage = useCallback(
    (page: number) => {
      const scroll = getScrollCapability(registryRef.current);
      if (!scroll?.scrollToPage) return;
      const liveTotal = Math.max(
        1,
        scroll.getTotalPages?.() ?? totalPages,
        totalPages
      );
      const clamped = Math.min(Math.max(1, page), liveTotal);
      scroll.scrollToPage({ pageNumber: clamped });
      onPageChange(clamped);
      refreshPageBox(clamped);
    },
    [onPageChange, refreshPageBox, totalPages]
  );

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

  const handleSaveMarkup = useCallback(async () => {
    if (!onSaveMarkup || !registryRef.current) return;
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
    await onSaveMarkup(result.buffer);
  }, [onSaveMarkup]);

  // Identity-stable across Fields ↔ Mark up and field-drag re-renders.
  const viewerConfig = useMemo(
    () => ({
      src,
      theme: { preference: "system" as const },
      tabBar: "never" as const,
      fonts: { ui: null, signature: null },
    }),
    [src]
  );

  return (
    <div
      data-testid="document-canvas"
      data-interaction={interaction}
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
        {interaction === "markup" && onSaveMarkup ? (
          <Button
            type="button"
            size="sm"
            disabled={!ready || savingMarkup}
            onClick={() => {
              void handleSaveMarkup().catch(() => {
                /* toast owned by parent */
              });
            }}
          >
            {savingMarkup ? "Saving to Seal…" : "Save to Seal"}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "border-border bg-card relative min-h-[36rem] overflow-hidden rounded-xl border",
          "[&_button[aria-label='Previous Page']]:hidden",
          "[&_button[aria-label='Next Page']]:hidden",
          "[&_input[aria-label='Current page']]:hidden",
          // Fields: keep the same PDF mount; hide annotate chrome so the overlay owns input.
          interaction === "fields" &&
            cn(
              "[&_[data-toolbar]]:pointer-events-none",
              "[&_[data-toolbar]]:opacity-0",
              "[&_[class*='annotation']]:pointer-events-none"
            )
        )}
      >
        <PDFViewer
          ref={viewerRef}
          style={{ width: "100%", height: "36rem" }}
          config={viewerConfig}
          onReady={(registry) => {
            handleReady(registry);
          }}
        />

        {interaction === "fields" && pageBox ? (
          <div
            ref={fieldContainerRef}
            data-testid="document-canvas-field-overlay"
            onDragOver={onFieldDragOver}
            onDrop={onFieldDrop}
            className={cn(
              "absolute z-20 overflow-hidden",
              fieldDragging && "ring-primary/30 ring-2"
            )}
            style={{
              left: pageBox.x,
              top: pageBox.y,
              width: pageBox.width,
              height: pageBox.height,
            }}
          >
            <PdfCanvasLayer
              pageNumber={currentPage}
              pdfWidth={pageBox.width}
              pdfHeight={pageBox.height}
              fields={fields}
              selectedFieldId={selectedFieldId}
              onFieldSelect={onFieldSelect}
              onFieldUpdate={onFieldUpdate}
            />
            {fieldOverlayExtra}
          </div>
        ) : null}
      </div>
    </div>
  );
}
