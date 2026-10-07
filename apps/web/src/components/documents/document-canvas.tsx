import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { dark, light } from "@seal/tokens/theme";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  ArrowUpRight,
  CaretLeft,
  CaretRight,
  ChatCircle,
  ChatCenteredText,
  Circle,
  CornersOut,
  Cursor,
  CursorText,
  Highlighter,
  LineSegment,
  Minus,
  PaintBrush,
  Path,
  PenNib,
  Plus,
  Polygon,
  Square,
  Swap,
  TextStrikethrough,
  TextT,
  TextUnderline,
  WaveSine,
  type Icon,
} from "@phosphor-icons/react";
import type { DragEvent, FormEvent, JSX, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/components/theme-provider";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

import type { PlacedField } from "./draggable-field";
import {
  centeredPageShift,
  markupClearsBecauseFieldArmed,
  markupExport,
  markupInkTools,
  markupLeaveSave,
  overlayOnRenderedPage,
  type MarkupExportTask,
  pageBoxFromMetrics,
  pageSlot,
  type PageBox,
} from "./document-surface";
import { PdfCanvasLayer } from "./pdf-canvas-layer";

type PluginRegistryLike = {
  getPlugin?: (id: string) => { provides?: () => unknown } | undefined;
};

type ScrollCapability = {
  getCurrentPage?: () => number;
  getTotalPages?: () => number;
  scrollToPage?: (options: {
    pageNumber: number;
    alignX?: number;
    alignY?: number;
    pageCoordinates?: { x: number; y: number };
    behavior?: "auto" | "smooth";
  }) => void;
  getMetrics?: () => {
    currentPage: number;
    pageVisibilityMetrics: Array<{
      pageNumber: number;
      viewportX: number;
      viewportY: number;
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
  requestZoomBy?: (
    delta: number,
    center?: { vx: number; vy: number }
  ) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  getState?: () => { currentZoomLevel?: number };
  onZoomChange?: (listener: (event: { newZoom: number }) => void) => () => void;
};

type ExportCapability = {
  saveAsCopy?: () => MarkupExportTask;
  forDocument?: (documentId: string) => { saveAsCopy: () => MarkupExportTask };
};

type DocumentManagerCapability = {
  getActiveDocumentId?: () => string | null;
  onDocumentOpened?: (listener: () => void) => () => void;
};

type MarkupTool = {
  id: string;
} | null;

type AnnotationCapability = {
  setActiveTool: (toolId: string | null) => void;
  getActiveTool: () => MarkupTool;
  getSelectedAnnotations: () => Array<{
    object: { id: string; pageIndex: number };
  }>;
  deleteAnnotations: (
    annotations: Array<{ pageIndex: number; id: string }>
  ) => void;
  onActiveToolChange: (listener: (tool: MarkupTool) => void) => () => void;
  onAnnotationEvent?: (
    listener: (event: { type: string; committed?: boolean }) => void
  ) => () => void;
};

type HistoryCapability = {
  undo: () => void;
  redo: () => void;
};

type CommandsCapability = {
  execute: (commandId: string) => void;
};

type MarkupToolDef = {
  id: string;
  command: string;
  label: string;
  icon: Icon;
};

const MARKUP_GROUPS: readonly {
  id: string;
  label: string;
  tools: readonly MarkupToolDef[];
}[] = [
  {
    id: "text",
    label: "Text",
    tools: [
      {
        id: "highlight",
        command: "annotation:add-highlight",
        label: "Highlight",
        icon: Highlighter,
      },
      {
        id: "strikeout",
        command: "annotation:add-strikeout",
        label: "Strikethrough",
        icon: TextStrikethrough,
      },
      {
        id: "underline",
        command: "annotation:add-underline",
        label: "Underline",
        icon: TextUnderline,
      },
      {
        id: "squiggly",
        command: "annotation:add-squiggly",
        label: "Squiggly",
        icon: WaveSine,
      },
      {
        id: "freeText",
        command: "annotation:add-text",
        label: "Text",
        icon: TextT,
      },
      {
        id: "insertText",
        command: "annotation:add-insert-text",
        label: "Insert text",
        icon: CursorText,
      },
      {
        id: "replaceText",
        command: "annotation:add-replace-text",
        label: "Replace text",
        icon: Swap,
      },
      {
        id: "textComment",
        command: "annotation:add-comment",
        label: "Comment",
        icon: ChatCircle,
      },
      {
        id: "freeTextCallout",
        command: "annotation:add-callout",
        label: "Callout",
        icon: ChatCenteredText,
      },
    ],
  },
  {
    id: "draw",
    label: "Draw",
    tools: [
      {
        id: "ink",
        command: "annotation:add-ink",
        label: "Pen",
        icon: PenNib,
      },
      {
        id: "inkHighlighter",
        command: "annotation:add-ink-highlighter",
        label: "Marker",
        icon: PaintBrush,
      },
    ],
  },
  {
    id: "shapes",
    label: "Shapes",
    tools: [
      {
        id: "square",
        command: "annotation:add-rectangle",
        label: "Rectangle",
        icon: Square,
      },
      {
        id: "circle",
        command: "annotation:add-circle",
        label: "Circle",
        icon: Circle,
      },
      {
        id: "line",
        command: "annotation:add-line",
        label: "Line",
        icon: LineSegment,
      },
      {
        id: "lineArrow",
        command: "annotation:add-arrow",
        label: "Arrow",
        icon: ArrowUpRight,
      },
      {
        id: "polygon",
        command: "annotation:add-polygon",
        label: "Polygon",
        icon: Polygon,
      },
      {
        id: "polyline",
        command: "annotation:add-polyline",
        label: "Polyline",
        icon: Path,
      },
    ],
  },
];

const SEAL_PDF_UI = {
  schema: {
    id: "seal-pdf",
    version: "1.0.0",
    toolbars: {},
    menus: {},
    sidebars: {},
    modals: {},
    selectionMenus: {},
  },
} as const;

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4] as const;
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 8;
/** Stage behind the page. Matches the app surface, per theme. */
const PAGE_STAGE = {
  light: light.surface,
  dark: dark.background,
} as const;

const TOOL_MENU_CLASS = "flex w-max flex-col gap-1 p-1.5";

const TOOL_HINTS: Record<string, string> = {
  highlight: "Drag across the text you want to highlight.",
  strikeout: "Drag across the text you want to strike.",
  underline: "Drag across the text you want to underline.",
  squiggly: "Drag across text to add a wavy underline.",
  freeText: "Click the page, then type.",
  insertText: "Click where the new text should go, then type.",
  replaceText: "Drag across the text you want to replace.",
  textComment: "Click the page to leave a comment.",
  freeTextCallout: "Click the page to add a callout.",
  ink: "Draw on the page. The mark saves when you lift.",
  inkHighlighter: "Drag to mark the page.",
  square: "Drag on the page to draw a rectangle.",
  circle: "Drag on the page to draw a circle.",
  line: "Drag on the page to draw a line.",
  lineArrow: "Drag on the page to draw an arrow.",
  polygon: "Click each corner, then click the first point to close.",
  polyline: "Click each point, then double-click to finish.",
};

function Tip({
  tip,
  children,
}: {
  tip: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span title={tip} className="inline-flex">
      {children}
    </span>
  );
}

function pinPageToTop(
  scroll: ScrollCapability | null,
  pageNumber: number
): void {
  scroll?.scrollToPage?.({
    pageNumber,
    alignX: 50,
    alignY: 0,
    pageCoordinates: { x: 0, y: 0 },
    behavior: "auto",
  });
}

function pdfScroller(frame: HTMLElement | null): HTMLElement | null {
  const root = frame?.querySelector("embedpdf-container")?.shadowRoot;
  if (!root) return null;
  for (const node of root.querySelectorAll<HTMLElement>("*")) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return null;
}

function getScrollCapability(registry: unknown): ScrollCapability | null {
  if (!registry || typeof registry !== "object") return null;
  const plugin = (registry as PluginRegistryLike).getPlugin?.("scroll");
  const provided = plugin?.provides?.();
  if (!provided || typeof provided !== "object") return null;
  return provided as ScrollCapability;
}

function getZoomCapability(registry: unknown): ZoomCapability | null {
  return getCapability<ZoomCapability>(registry, "zoom");
}

function getCapability<T>(registry: unknown, pluginId: string): T | null {
  if (!registry || typeof registry !== "object") return null;
  const plugin = (registry as PluginRegistryLike).getPlugin?.(pluginId);
  const provided = plugin?.provides?.();
  if (!provided || typeof provided !== "object") return null;
  return provided as T;
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
  let layoutPage: (typeof layout.virtualItems)[number]["pageLayouts"][number] | undefined;
  for (const item of layout.virtualItems) {
    const page = item.pageLayouts.find((p) => p.pageNumber === pageNumber);
    if (page) {
      layoutPage = page;
      break;
    }
  }
  return pageBoxFromMetrics(visibility, layoutPage);
}

function renderedPageElement(
  frame: HTMLElement,
  pageNumber: number,
  width: number,
  height: number
): HTMLElement | null {
  const root = frame.querySelector("embedpdf-container")?.shadowRoot;
  if (!root) return null;
  const matches = (node: HTMLElement): boolean => {
    const w = Number.parseFloat(node.style.width);
    const h = Number.parseFloat(node.style.height);
    return (
      Number.isFinite(w) &&
      Number.isFinite(h) &&
      Math.abs(w - width) < 2 &&
      Math.abs(h - height) < 2 &&
      node.querySelector("img") !== null
    );
  };
  const pages = [...root.querySelectorAll("div")].filter(
    (node): node is HTMLDivElement =>
      matches(node) &&
      !(
        node.parentElement instanceof HTMLElement &&
        matches(node.parentElement)
      )
  );
  return (
    pageSlot(
      pages.map((node) => ({
        top: node.getBoundingClientRect().top,
        node,
      })),
      pageNumber
    )?.node ?? null
  );
}

function placeBoxOnRenderedPage(
  frame: HTMLElement | null,
  pageNumber: number,
  box: PageBox
): PageBox {
  if (!frame) return box;
  const page = renderedPageElement(frame, pageNumber, box.width, box.height);
  if (page) {
    const frameRect = frame.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    return overlayOnRenderedPage(
      {
        left: frameRect.left,
        top: frameRect.top,
        clientLeft: frame.clientLeft,
        clientTop: frame.clientTop,
      },
      {
        left: pageRect.left,
        top: pageRect.top,
        width: pageRect.width,
        height: pageRect.height,
      },
      box
    );
  }
  const scroller = pdfScroller(frame);
  if (!scroller) return box;
  return {
    ...box,
    x: box.x + centeredPageShift(scroller.clientWidth, box.width, scroller.scrollLeft),
  };
}

export type DocumentCanvasInteraction = "fields" | "markup" | "view";

export type DocumentCanvasProps = {
  src: string;
  /**
   * Shared EmbedPDF surface.
   * - fields / markup: one Seal tool row. A chosen markup tool draws;
   *   otherwise the field overlay owns the page.
   * - view: read-only browse; field markers visible, non-interactive
   */
  interaction: DocumentCanvasInteraction;
  layoutActive?: boolean;
  suspendMarkup?: boolean;
  toolbarExtras?: ReactNode;
  onMarkupToolChange?: (toolId: string | null) => void;
  onClearTool?: () => void;
  onEmptyClick?: (clientX: number, clientY: number) => void;
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
  onSaveMarkup?: (
    buffer: ArrayBuffer,
    options?: { keepalive?: boolean }
  ) => void | Promise<void>;
};

/**
 * One shared PDF canvas for Document Workspace.
 * Fields / Mark up / view keep the same EmbedPDF mount; only chrome + overlay change.
 */
export function DocumentCanvas({
  src,
  interaction,
  layoutActive = false,
  suspendMarkup = false,
  toolbarExtras = null,
  onMarkupToolChange,
  onClearTool,
  onEmptyClick,
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
}: DocumentCanvasProps): JSX.Element {
  const viewerRef = useRef<PDFViewerRef>(null);
  const registryRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [pageBox, setPageBox] = useState<PageBox | null>(null);
  const [zoom, setZoom] = useState(1);
  const [markupTool, setMarkupTool] = useState<string | null>(null);
  const [openMarkupGroup, setOpenMarkupGroup] = useState<string | null>(null);
  const onMarkupToolChangeRef = useRef(onMarkupToolChange);
  onMarkupToolChangeRef.current = onMarkupToolChange;
  const onPageChangeRef = useRef(onPageChange);
  const onDocumentMetaRef = useRef(onDocumentMeta);
  const onZoomChangeRef = useRef(onZoomChange);
  onPageChangeRef.current = onPageChange;
  onDocumentMetaRef.current = onDocumentMeta;
  onZoomChangeRef.current = onZoomChange;

  const editing = interaction !== "view";
  const drawing = editing && markupTool !== null && !suspendMarkup;
  const showFieldOverlay = true;
  const fieldsInteractive = editing && !drawing && !layoutActive;
  const markup = editing;

  const viewerFrameRef = useRef<HTMLDivElement>(null);

  const refreshPageBox = useCallback((pageNumber: number) => {
    const scroll = getScrollCapability(registryRef.current);
    if (!scroll) return;
    const metrics = resolvePageBox(scroll, pageNumber);
    const box = metrics
      ? placeBoxOnRenderedPage(viewerFrameRef.current, pageNumber, metrics)
      : null;
    setPageBox(box);
    if (box) {
      onDocumentMetaRef.current?.({
        numPages: scroll.getTotalPages?.() ?? 1,
        pageWidth: box.naturalWidth,
        pageHeight: box.naturalHeight,
      });
    }
  }, []);

  // Pages don't paint until a zoom/layout event — request fit-width when the
  // document actually opens (ready alone races document load and no-ops).
  const docOpenedSubRef = useRef<(() => void) | null>(null);
  const followFitRef = useRef(false);
  const fittingRef = useRef(false);

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
      docOpenedSubRef.current?.();
      const docManager = (
        (registry as PluginRegistryLike).getPlugin?.("document-manager")
          ?.provides?.() as DocumentManagerCapability | undefined
      );
      docOpenedSubRef.current =
        docManager?.onDocumentOpened?.(() => {
          // Scroll viewport mounts after document-opened — defer the zoom
          // request so it lands on a live viewport and forces first paint.
          window.setTimeout(() => {
            getZoomCapability(registry)?.requestZoom?.(1);
            window.setTimeout(() => {
              pinPageToTop(getScrollCapability(registry), 1);
              refreshPageBox(1);
            }, 50);
          }, 150);
        }) ?? null;
    },
    [refreshPageBox]
  );

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // EmbedPDF reads src only when the viewer mounts. A replaced file (rotate,
  // crop, save) must remount, and the old viewer must not stay "ready".
  useEffect(() => {
    setReady(false);
  }, [src]);

  useEffect(() => {
    const frame = viewerFrameRef.current;
    if (!frame) return undefined;
    const hideSplash = (): void => {
      const host = frame.querySelector("embedpdf-container");
      const root = host?.shadowRoot;
      if (!root || root.querySelector("[data-seal-hide-engine-splash]")) return;
      const style = document.createElement("style");
      style.dataset.sealHideEngineSplash = "true";
      style.textContent =
        ".flex.h-full.items-center.justify-center{display:none!important}";
      root.appendChild(style);
    };
    hideSplash();
    const observer = new MutationObserver(hideSplash);
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [src]);

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

  useEffect(() => {
    if (!ready) return undefined;
    const zoomCap = getZoomCapability(registryRef.current);
    if (!zoomCap?.onZoomChange) return undefined;
    return zoomCap.onZoomChange((event) => {
      if (!fittingRef.current) followFitRef.current = false;
      if (fittingRef.current) {
        pinPageToTop(getScrollCapability(registryRef.current), 1);
      }
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
    pinPageToTop(scroll, currentPage);
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
      scroll.scrollToPage({
        pageNumber: clamped,
        alignX: 0,
        alignY: 0,
        pageCoordinates: { x: 0, y: 0 },
        behavior: "auto",
      });
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

  const requestFit = useCallback(() => {
    const before = getZoomCapability(registryRef.current)?.getState?.()
      ?.currentZoomLevel;
    fittingRef.current = true;
    followFitRef.current = true;
    getZoomCapability(registryRef.current)?.requestZoom?.("fit-width");
    window.setTimeout(() => {
      const after = getZoomCapability(registryRef.current)?.getState?.()
        ?.currentZoomLevel;
      if (
        typeof before === "number" &&
        typeof after === "number" &&
        Math.abs(before - after) < 0.01
      ) {
        toast.info("Already fit to the width of the window.");
      }
      pinPageToTop(getScrollCapability(registryRef.current), 1);
      refreshPageBox(
        getScrollCapability(registryRef.current)?.getCurrentPage?.() ?? 1
      );
      fittingRef.current = false;
    }, 250);
  }, []);

  const setZoomLevel = useCallback(
    (level: number | string) => {
      if (level === "fit-width") {
        requestFit();
        return;
      }
      fittingRef.current = false;
      followFitRef.current = false;
      getZoomCapability(registryRef.current)?.requestZoom?.(level);
    },
    [requestFit]
  );

  useEffect(() => {
    if (!ready) return undefined;
    const node = viewerFrameRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => {
      if (!followFitRef.current) return;
      requestFit();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, requestFit]);

  // The field layer sits on top of the page, so a pinch there never reaches
  // the viewer. Handle it here or the browser zooms the whole window instead.
  useEffect(() => {
    const frame = viewerFrameRef.current;
    if (!frame || !ready) return undefined;
    const onWheel = (event: WheelEvent): void => {
      const overlay = frame.querySelector(
        "[data-testid=document-canvas-field-overlay]"
      );
      if (!(overlay instanceof HTMLElement) || !overlay.contains(event.target as Node)) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        const zoomCap = getZoomCapability(registryRef.current);
        const current = zoomCap?.getState?.()?.currentZoomLevel;
        if (!zoomCap?.requestZoomBy || typeof current !== "number") return;
        event.preventDefault();
        const factor = 1 - event.deltaY * 0.01;
        const next = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, current * factor)
        );
        const bounds = frame.getBoundingClientRect();
        zoomCap.requestZoomBy(next - current, {
          vx: event.clientX - bounds.left,
          vy: event.clientY - bounds.top,
        });
        return;
      }
      const scroller = pdfScroller(frame);
      if (!scroller) return;
      event.preventDefault();
      scroller.scrollBy({ left: event.deltaX, top: event.deltaY });
    };
    frame.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      frame.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [ready]);

  const zoomToNearestLevel = useCallback(
    (direction: "in" | "out") => {
      const delta = direction === "in" ? ZOOM_STEP : -ZOOM_STEP;
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.round((zoom + delta) * 100) / 100)
      );
      if (next !== zoom) setZoomLevel(next);
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
        case "Backspace":
        case "Delete":
          if (!markup) return;
          event.preventDefault();
          deleteSelectedMarks();
          break;
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

  const fileEpochRef = useRef(0);
  useEffect(() => {
    fileEpochRef.current += 1;
  }, [src]);

  const onSaveMarkupRef = useRef(onSaveMarkup);
  onSaveMarkupRef.current = onSaveMarkup;

  const readMarkup = useCallback(async (epoch: number): Promise<ArrayBuffer | null> => {
    if (!registryRef.current) return null;
    const registry = registryRef.current as PluginRegistryLike;
    const exportPlugin = registry.getPlugin?.("export");
    const documentManager = registry.getPlugin?.("document-manager");
    const exportCap = exportPlugin?.provides?.() as ExportCapability | undefined;
    const docsCap = documentManager?.provides?.() as
      | DocumentManagerCapability
      | undefined;
    const documentId = docsCap?.getActiveDocumentId?.();
    const save = markupExport(exportCap, documentId);
    if (!save) throw new Error("EmbedPDF export is not ready");
    const buffer = await save().toPromise();
    if (fileEpochRef.current !== epoch) return null;
    return buffer;
  }, []);

  // The copy is taken as soon as the mark commits. The upload waits so a run of
  // strokes becomes one write, unless the page leaves first.
  useEffect(() => {
    if (!ready || !onSaveMarkupRef.current) return undefined;
    const annotation = getCapability<AnnotationCapability>(
      registryRef.current,
      "annotation"
    );
    if (!annotation?.onAnnotationEvent) return undefined;

    let stopped = false;
    let timer: number | undefined;
    let running = false;
    let pending = false;
    let latest: ArrayBuffer | null = null;
    let exportId = 0;
    let leave: { keepalive: boolean } | null = null;

    const upload = (options?: { keepalive?: boolean }): void => {
      const saveMarkup = onSaveMarkupRef.current;
      if (!latest || !saveMarkup || stopped || running) {
        pending = !stopped && running;
        return;
      }
      const buffer = latest;
      latest = null;
      running = true;
      pending = false;
      void Promise.resolve(saveMarkup(buffer, options))
        .catch((error: unknown) => {
          toast.error("Failed to save the markup", {
            description: error instanceof Error ? error.message : undefined,
          });
        })
        .finally(() => {
          running = false;
          if (pending && !stopped) upload();
        });
    };

    const schedule = (): void => {
      if (leave) {
        const options = leave;
        leave = null;
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
        upload({ keepalive: options.keepalive });
        return;
      }
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        upload();
      }, 400);
    };

    const unsubscribe = annotation.onAnnotationEvent((event) => {
      if (event.type === "loaded" || event.committed !== true) return;
      const epoch = fileEpochRef.current;
      const id = ++exportId;
      void readMarkup(epoch)
        .then((buffer) => {
          if (stopped || id !== exportId || !buffer) return;
          latest = buffer;
          schedule();
        })
        .catch((error: unknown) => {
          toast.error("Failed to save the markup", {
            description: error instanceof Error ? error.message : undefined,
          });
        });
    });

    const flushOnLeave = (reason: "pagehide" | "hidden" | "unmount"): void => {
      const save = markupLeaveSave(reason);
      if (!save.flush) return;
      if (!latest) {
        leave = { keepalive: save.keepalive };
        return;
      }
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      upload({ keepalive: save.keepalive });
    };
    const onPageHide = (): void => {
      flushOnLeave("pagehide");
    };
    const onHide = (): void => {
      if (document.visibilityState === "hidden") flushOnLeave("hidden");
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("visibilitychange", onHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("visibilitychange", onHide);
      flushOnLeave("unmount");
      stopped = true;
      unsubscribe();
    };
  }, [ready, readMarkup]);

  const { resolvedTheme } = useTheme();

  // Identity-stable across Fields ↔ Mark up ↔ view and field-drag re-renders.
  const viewerConfig = useMemo(
    () => ({
      src,
      theme: {
        preference: resolvedTheme,
        light: {
          background: { app: PAGE_STAGE.light, surface: PAGE_STAGE.light },
        },
        dark: {
          background: { app: PAGE_STAGE.dark, surface: PAGE_STAGE.dark },
        },
      },
      tabBar: "never" as const,
      fonts: { ui: null, signature: null },
      zoom: {
        defaultZoomLevel: 1,
        minZoom: 0.5,
        maxZoom: 8,
      },
      annotations: {
        tools: markupInkTools().map((tool) => {
          // The override type only lists shared behavior fields. commitDelay is
          // ink-only, so it has to travel with one of those fields (this default).
          const behavior = {
            commitDelay: tool.behavior.commitDelay,
            deactivateToolAfterCreate: false as const,
          };
          return { id: tool.id, behavior };
        }),
      },
      ui: SEAL_PDF_UI,
    }),
    [resolvedTheme, src]
  );

  useEffect(() => {
    const annotation = getCapability<AnnotationCapability>(
      registryRef.current,
      "annotation"
    );
    if (!annotation) return;
    if (!markup) {
      annotation.setActiveTool(null);
      setMarkupTool(null);
      return;
    }
    setMarkupTool(annotation.getActiveTool()?.id ?? null);
    return annotation.onActiveToolChange((tool) => {
      setMarkupTool(tool?.id ?? null);
    });
  }, [markup, ready]);

  useEffect(() => {
    onMarkupToolChangeRef.current?.(markupTool);
  }, [markupTool]);

  const wasSuspendedRef = useRef(suspendMarkup);
  useEffect(() => {
    const clearMarkup = markupClearsBecauseFieldArmed(
      wasSuspendedRef.current,
      suspendMarkup
    );
    wasSuspendedRef.current = suspendMarkup;
    if (!clearMarkup) return;
    getCapability<AnnotationCapability>(
      registryRef.current,
      "annotation"
    )?.setActiveTool(null);
    setMarkupTool(null);
    setOpenMarkupGroup(null);
  }, [suspendMarkup]);

  const selectMarkupTool = (toolId: string | null, command?: string): void => {
    setOpenMarkupGroup(null);
    const annotation = getCapability<AnnotationCapability>(
      registryRef.current,
      "annotation"
    );
    if (toolId === null) {
      annotation?.setActiveTool(null);
      setMarkupTool(null);
      return;
    }
    if (command) {
      getCapability<CommandsCapability>(
        registryRef.current,
        "commands"
      )?.execute(command);
    } else {
      annotation?.setActiveTool(toolId);
    }
    setMarkupTool(toolId);
  };

  const deleteSelectedMarks = (): void => {
    const annotation = getCapability<AnnotationCapability>(
      registryRef.current,
      "annotation"
    );
    if (!annotation) return;
    const selected = annotation.getSelectedAnnotations();
    if (selected.length === 0) return;
    annotation.deleteAnnotations(
      selected.map((mark) => ({
        pageIndex: mark.object.pageIndex,
        id: mark.object.id,
      }))
    );
  };

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div
      data-testid="document-canvas"
      data-interaction={interaction}
      className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}
    >
      <div className="flex min-w-0 items-center">
        <div className="bg-kumo-surface/95 flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border p-1 shadow-sm">
          {markup ? (
            <Tip tip="Undo the last mark">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Undo"
              disabled={!ready}
              onClick={() =>
                getCapability<HistoryCapability>(
                  registryRef.current,
                  "history"
                )?.undo()
              }
              icon={ArrowUUpLeft}
            />
            </Tip>
          ) : (
            <Tip tip="Previous page">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Previous page"
              disabled={!ready || currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              icon={CaretLeft}
            />
            </Tip>
          )}
          <form
            onSubmit={handlePageInputSubmit}
            className="flex shrink-0 items-center gap-1"
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
              className="h-6.5 w-12 px-1 text-center text-sm"
              aria-label="Current page"
              title="Type a page number, then press Enter"
            />
            <span className="text-kumo-secondary text-sm whitespace-nowrap">
              / {totalPages}
            </span>
          </form>
          {markup ? (
            <Tip tip="Redo the last mark">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Redo"
              disabled={!ready}
              onClick={() =>
                getCapability<HistoryCapability>(
                  registryRef.current,
                  "history"
                )?.redo()
              }
              icon={ArrowUUpRight}
            />
            </Tip>
          ) : (
            <Tip tip="Next page">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Next page"
              disabled={!ready || currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
              icon={CaretRight}
            />
            </Tip>
          )}

          <Tip tip="Zoom out 25%">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Zoom out"
            disabled={!ready || zoom <= 0.5}
            onClick={() => zoomToNearestLevel("out")}
            icon={Minus}
          />
          </Tip>
          <span title="Choose a zoom level" className="inline-flex">
          <Select
            value={zoom.toFixed(2)}
            onValueChange={(value) => {
              if (value) setZoomLevel(Number.parseFloat(value));
            }}
            size="sm"
            renderValue={() => `${zoomPercentage}%`}
            className="hidden w-18 sm:flex"
            disabled={!ready}
          >
            {ZOOM_LEVELS.map((level) => (
              <Select.Option key={level} value={level.toFixed(2)}>
                {Math.round(level * 100)}%
              </Select.Option>
            ))}
          </Select>
          </span>
          <span className="text-kumo-secondary min-w-10 text-center text-xs sm:hidden">
            {zoomPercentage}%
          </span>
          <Tip tip="Zoom in 25%">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Zoom in"
            disabled={!ready || zoom >= 8}
            onClick={() => zoomToNearestLevel("in")}
            icon={Plus}
          />
          </Tip>

          <Tip tip="Fit the page to the width of the window">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Fit to width"
            disabled={!ready}
            onClick={() => setZoomLevel("fit-width")}
            className="hidden sm:inline-flex"
            icon={CornersOut}
          >
            Fit
          </Button>
          </Tip>
          {markup ? (
            <>
              <Tip tip="Select a mark or a field">
              <Button
                type="button"
                variant={
                  markupTool === null && !layoutActive && !suspendMarkup
                    ? "primary"
                    : "ghost"
                }
                size="sm"
                shape="square"
                aria-label="Select"
                disabled={!ready}
                onClick={() => {
                  selectMarkupTool(null);
                  onClearTool?.();
                }}
                icon={Cursor}
              />
              </Tip>
              {toolbarExtras}
              {MARKUP_GROUPS.map((group) => {
                const activeTool = group.tools.find(
                  (tool) => tool.id === markupTool
                );
                const GroupIcon = activeTool?.icon ?? group.tools[0]?.icon;
                return (
                  <Tip
                    key={group.id}
                    tip={
                      group.id === "text"
                        ? "Marks on the text, and notes you type"
                        : group.id === "draw"
                          ? "Draw on the page"
                          : "Shapes you drag onto the page"
                    }
                  >
                  <Popover
                    open={openMarkupGroup === group.id}
                    onOpenChange={(open) => {
                      setOpenMarkupGroup(open ? group.id : null);
                    }}
                  >
                    <Popover.Trigger
                      render={
                        <Button
                          type="button"
                          variant={activeTool ? "primary" : "ghost"}
                          size="sm"
                          disabled={!ready || GroupIcon === undefined}
                          icon={GroupIcon}
                        >
                          {activeTool?.label ?? group.label}
                        </Button>
                      }
                    />
                    <Popover.Content
                      className={TOOL_MENU_CLASS}
                      align="start"
                    >
                      {group.tools.map((tool) => (
                        <Tip key={tool.id} tip={TOOL_HINTS[tool.id] ?? tool.label}>
                        <Button
                          type="button"
                          variant={markupTool === tool.id ? "primary" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          icon={tool.icon}
                          onClick={() => {
                            selectMarkupTool(tool.id, tool.command);
                          }}
                        >
                          {tool.label}
                        </Button>
                        </Tip>
                      ))}
                    </Popover.Content>
                  </Popover>
                  </Tip>
                );
              })}
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={viewerFrameRef}
        className={cn(
          "border-kumo-line bg-kumo-base relative min-h-0 flex-1 overflow-hidden rounded-xl border",
          !drawing && "[&_[class*='annotation']]:pointer-events-none"
        )}
      >
        <PDFViewer
          key={`${src}:${resolvedTheme}`}
          ref={viewerRef}
          className="h-full w-full"
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
              fieldsInteractive && fieldDragging && "ring-kumo-focus ring-2",
              !fieldsInteractive && !layoutActive && "pointer-events-none"
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
              onEmptyClick={
                fieldsInteractive && onEmptyClick ? onEmptyClick : undefined
              }
            />
            {fieldOverlayExtra}
          </div>
        ) : null}
      </div>
    </div>
  );
}
