import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import {
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  CornersOut,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import type { DragEvent, FormEvent, JSX, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { PlacedField } from "./draggable-field";
import { PdfCanvasLayer } from "./pdf-canvas-layer";

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

type ZoomCapability = {
  requestZoom?: (level: number | string) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  getState?: () => { currentZoomLevel?: number };
  onZoomChange?: (listener: (event: { newZoom: number }) => void) => () => void;
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

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function getScrollCapability(registry: unknown): ScrollCapability | null {
  if (!registry || typeof registry !== "object") return null;
  const plugin = (registry as PluginRegistryLike).getPlugin?.("scroll");
  const provided = plugin?.provides?.();
  if (!provided || typeof provided !== "object") return null;
  return provided as ScrollCapability;
}

function getZoomCapability(registry: unknown): ZoomCapability | null {
  if (!registry || typeof registry !== "object") return null;
  const plugin = (registry as PluginRegistryLike).getPlugin?.("zoom");
  const provided = plugin?.provides?.();
  if (!provided || typeof provided !== "object") return null;
  return provided as ZoomCapability;
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

export type DocumentCanvasInteraction = "fields" | "markup" | "view";

export type DocumentCanvasProps = {
  src: string;
  /**
   * Shared EmbedPDF surface.
   * - fields: Seal field overlay owns input; annotate chrome hidden
   * - markup: EmbedPDF annotate chrome + Save to Seal
   * - view: read-only browse; field markers visible, non-interactive
   */
  interaction: DocumentCanvasInteraction;
  className?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onDocumentMeta?: (meta: {
    numPages: number;
    pageWidth: number;
    pageHeight: number;
  }) => void;
  onZoomChange?: (zoom: number) => void;
  enableKeyboardShortcuts?: boolean;
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
 * Fields / Mark up / view keep the same EmbedPDF mount; only chrome + overlay change.
 */
export function DocumentCanvas({
  src,
  interaction,
  className,
  currentPage,
  onPageChange,
  onDocumentMeta,
  onZoomChange,
  enableKeyboardShortcuts = true,
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
  const [zoom, setZoom] = useState(1);
  const onPageChangeRef = useRef(onPageChange);
  const onDocumentMetaRef = useRef(onDocumentMeta);
  const onZoomChangeRef = useRef(onZoomChange);
  onPageChangeRef.current = onPageChange;
  onDocumentMetaRef.current = onDocumentMeta;
  onZoomChangeRef.current = onZoomChange;

  const showFieldOverlay = interaction === "fields" || interaction === "view";
  const fieldsInteractive = interaction === "fields";
  const hideAnnotateChrome = interaction !== "markup";

  const refreshPageBox = useCallback((pageNumber: number) => {
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
  }, []);

  // Pages don't paint until the first zoom/layout event — request fit-width
  // once the viewer is ready, and retry once on the first page event in case
  // the ready call raced document load.
  const fitRetriedRef = useRef(false);
  useEffect(() => {
    fitRetriedRef.current = false;
  }, [src]);

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
      const zoomCap = getZoomCapability(registry);
      const level = zoomCap?.getState?.()?.currentZoomLevel;
      if (typeof level === "number" && level > 0) {
        setZoom(level);
        onZoomChangeRef.current?.(level);
      }
      getZoomCapability(registry)?.requestZoom?.("fit-width");
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
      if (!fitRetriedRef.current) {
        fitRetriedRef.current = true;
        getZoomCapability(registryRef.current)?.requestZoom?.("fit-width");
      }
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

  useEffect(() => {
    if (!ready) return undefined;
    const zoomCap = getZoomCapability(registryRef.current);
    if (!zoomCap?.onZoomChange) return undefined;
    return zoomCap.onZoomChange((event) => {
      setZoom(event.newZoom);
      onZoomChangeRef.current?.(event.newZoom);
      const page =
        getScrollCapability(registryRef.current)?.getCurrentPage?.() ??
        currentPage;
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

  const setZoomLevel = useCallback((level: number | string) => {
    getZoomCapability(registryRef.current)?.requestZoom?.(level);
  }, []);

  const zoomToNearestLevel = useCallback(
    (direction: "in" | "out") => {
      const ordered =
        direction === "in" ? [...ZOOM_LEVELS] : [...ZOOM_LEVELS].reverse();
      const next = ordered.find((level) =>
        direction === "in" ? level > zoom + 0.001 : level < zoom - 0.001
      );
      if (next !== undefined) {
        setZoomLevel(next);
      } else if (direction === "in") {
        getZoomCapability(registryRef.current)?.zoomIn?.();
      } else {
        getZoomCapability(registryRef.current)?.zoomOut?.();
      }
    },
    [zoom, setZoomLevel]
  );

  // SEA-79: keyboard page navigation (same contract as PdfViewerControls).
  useEffect(() => {
    if (!enableKeyboardShortcuts) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      switch (event.key) {
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          goToPage(currentPage - 1);
          break;
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          goToPage(currentPage + 1);
          break;
        case "Home":
          event.preventDefault();
          goToPage(1);
          break;
        case "End":
          event.preventDefault();
          goToPage(totalPages);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, goToPage, currentPage, totalPages]);

  const handleSaveMarkup = useCallback(async () => {
    if (!onSaveMarkup || !registryRef.current) return;
    const registry = registryRef.current as PluginRegistryLike;
    const exportPlugin = registry.getPlugin?.("export");
    const documentManager = registry.getPlugin?.("document-manager");
    const exportCap = exportPlugin?.provides?.() as
      | ExportCapability
      | undefined;
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

  // Identity-stable across Fields ↔ Mark up ↔ view and field-drag re-renders.
  const viewerConfig = useMemo(
    () => ({
      src,
      theme: { preference: "system" as const },
      tabBar: "never" as const,
      fonts: { ui: null, signature: null },
      zoom: {
        defaultZoomLevel: 1,
        minZoom: 0.5,
        maxZoom: 2,
      },
    }),
    [src]
  );

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div
      data-testid="document-canvas"
      data-interaction={interaction}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="bg-kumo-surface/95 flex flex-wrap items-center gap-1 rounded-lg border p-1.5 shadow-sm sm:gap-2">
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
                if (
                  Number.isNaN(pageNum) ||
                  pageNum < 1 ||
                  pageNum > totalPages
                ) {
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

          <div className="bg-kumo-hairline mx-0.5 hidden h-5 w-px sm:block" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Zoom out"
            disabled={!ready || zoom <= 0.5}
            onClick={() => zoomToNearestLevel("out")}
            className="size-8"
            icon={Minus}
          />
          <Select
            value={zoom.toFixed(2)}
            onValueChange={(value) => {
              if (value) setZoomLevel(Number.parseFloat(value));
            }}
            size="sm"
            renderValue={() => `${zoomPercentage}%`}
            className="hidden h-8 w-18 px-2 text-xs sm:flex"
            disabled={!ready}
          >
            {ZOOM_LEVELS.map((level) => (
              <Select.Option key={level} value={level.toFixed(2)}>
                {Math.round(level * 100)}%
              </Select.Option>
            ))}
          </Select>
          <span className="text-kumo-secondary min-w-10 text-center text-xs sm:hidden">
            {zoomPercentage}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Zoom in"
            disabled={!ready || zoom >= 2}
            onClick={() => zoomToNearestLevel("in")}
            className="size-8"
            icon={Plus}
          />

          <div className="bg-kumo-hairline mx-0.5 hidden h-5 w-px sm:block" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Reset zoom and position"
            disabled={!ready}
            onClick={() => setZoomLevel(1)}
            className="hidden h-8 px-2 text-xs sm:inline-flex"
            icon={ArrowCounterClockwise}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Fit to width (100%)"
            disabled={!ready}
            onClick={() => setZoomLevel("fit-width")}
            className="hidden h-8 px-2 text-xs sm:inline-flex"
            icon={CornersOut}
          >
            Fit
          </Button>
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
          "border-border bg-card relative min-h-144 overflow-hidden rounded-xl border",
          "[&_button[aria-label='Previous Page']]:hidden",
          "[&_button[aria-label='Next Page']]:hidden",
          "[&_input[aria-label='Current page']]:hidden",
          // Fields/view: keep the same PDF mount; hide annotate chrome so overlay/browse owns input.
          hideAnnotateChrome &&
            cn(
              "[&_[data-toolbar]]:pointer-events-none",
              "[&_[data-toolbar]]:opacity-0",
              "[&_[class*='annotation']]:pointer-events-none"
            )
        )}
      >
        <PDFViewer
          ref={viewerRef}
          className="h-144 w-full"
          config={viewerConfig}
          onReady={(registry) => {
            handleReady(registry);
          }}
        />

        {showFieldOverlay && pageBox ? (
          <div
            ref={fieldContainerRef}
            data-testid="document-canvas-field-overlay"
            data-engine="pdfium"
            data-page-number={currentPage}
            onDragOver={fieldsInteractive ? onFieldDragOver : undefined}
            onDrop={fieldsInteractive ? onFieldDrop : undefined}
            className={cn(
              "absolute z-20 overflow-hidden",
              fieldsInteractive && fieldDragging && "ring-primary/30 ring-2",
              !fieldsInteractive && "pointer-events-none"
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
              interactive={fieldsInteractive}
              fields={fields}
              selectedFieldId={fieldsInteractive ? selectedFieldId : null}
              onFieldSelect={fieldsInteractive ? onFieldSelect : undefined}
              onFieldUpdate={fieldsInteractive ? onFieldUpdate : undefined}
            />
            {fieldOverlayExtra}
          </div>
        ) : null}
      </div>
    </div>
  );
}
