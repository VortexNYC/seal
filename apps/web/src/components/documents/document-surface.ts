import { canvas } from "@seal/tokens/theme";

export type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
};

export type PageVisibilitySlice = {
  viewportX: number;
  viewportY: number;
  scaled: {
    pageX: number;
    pageY: number;
    scale: number;
  };
};

export type PageLayoutSize = {
  width: number;
  height: number;
  rotatedWidth: number;
  rotatedHeight: number;
};

/**
 * EmbedPDF's scaled.pageX is how far into the page the visible slice starts.
 * It is 0 when the page's left edge is on screen, including when the sheet
 * is centered in a wider stage. This box is that slice, not the painted page.
 */
export function pageBoxFromMetrics(
  visibility: PageVisibilitySlice | undefined,
  layout: PageLayoutSize | undefined
): PageBox | null {
  if (!visibility || !layout) return null;
  const naturalWidth = layout.rotatedWidth || layout.width;
  const naturalHeight = layout.rotatedHeight || layout.height;
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;
  const scale = visibility.scaled.scale || 1;
  return {
    x: visibility.viewportX - visibility.scaled.pageX,
    y: visibility.viewportY - visibility.scaled.pageY,
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    scale,
    naturalWidth,
    naturalHeight,
  };
}

export function overlayOnRenderedPage<T extends PageBox>(
  frame: {
    left: number;
    top: number;
    clientLeft: number;
    clientTop: number;
  },
  page: { left: number; top: number; width: number; height: number },
  box: T
): T {
  return {
    ...box,
    x: page.left - frame.left - frame.clientLeft,
    y: page.top - frame.top - frame.clientTop,
    width: page.width,
    height: page.height,
  };
}

/** Horizontal centering when the page shell is not in the DOM yet. */
export function centeredPageShift(
  clientWidth: number,
  pageWidth: number,
  scrollLeft: number
): number {
  return (clientWidth - pageWidth) / 2 - scrollLeft;
}

export type PageShell<T> = {
  readonly top: number;
  readonly node: T;
};

/**
 * Each page paints two same-sized shells. One slot per vertical position,
 * in page order, so page 2 is not the second shell of page 1.
 */
export function pageSlot<T>(
  shells: readonly PageShell<T>[],
  pageNumber: number
): PageShell<T> | null {
  if (pageNumber < 1) return null;
  const ordered = [...shells].sort((a, b) => a.top - b.top);
  const slots: PageShell<T>[] = [];
  for (const shell of ordered) {
    const previous = slots[slots.length - 1];
    if (previous === undefined || Math.abs(previous.top - shell.top) > 4) {
      slots.push(shell);
    }
  }
  return slots[pageNumber - 1] ?? null;
}

/**
 * Clear the pen only when a field is newly armed. A pen chosen while a
 * field is still armed must survive the render that drops the field.
 */
export function markupClearsBecauseFieldArmed(
  wasSuspended: boolean,
  suspendMarkup: boolean
): boolean {
  return suspendMarkup && !wasSuspended;
}

export const FIELD_PAD_X = 8;
export const FIELD_ICON_SIZE = 12;
export const FIELD_ICON_GAP = 6;

/** Approximate width of the canvas label at 11px semibold. */
const FIELD_CHAR_PX = 6.6;

export function fieldTextOffset(hasIcon: boolean): number {
  return hasIcon ? FIELD_PAD_X + FIELD_ICON_SIZE + FIELD_ICON_GAP : FIELD_PAD_X;
}

export function fieldRowWidth(label: string): number {
  return (
    fieldTextOffset(true) + Math.ceil(label.length * FIELD_CHAR_PX) + FIELD_PAD_X
  );
}

/** Drop the generated " Field" suffix so the chip can stay one line. */
export function fieldDisplayLabel(
  typeLabel: string,
  label: string | undefined
): string {
  if (!label || label === `${typeLabel} Field`) return typeLabel;
  return label;
}

export function pagePercent(px: number, natural: number): number {
  return (px / natural) * 100;
}

/**
 * Field size is a fraction of the PDF page. Zoom changes the rendered
 * page, not the stored percent.
 */
export function fieldPlacementBox(input: {
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  pageLeft: number;
  pageTop: number;
  clientX: number;
  clientY: number;
  widthPx: number;
  heightPx: number;
  anchor: "center" | "bottom";
}): { x: number; y: number; width: number; height: number } {
  const scaleX = input.renderedWidth / input.naturalWidth;
  const scaleY = input.renderedHeight / input.naturalHeight;
  const renderedW = input.widthPx * scaleX;
  const renderedH = input.heightPx * scaleY;
  const localX = input.clientX - input.pageLeft - renderedW / 2;
  const localY =
    input.anchor === "bottom"
      ? input.clientY - input.pageTop - renderedH
      : input.clientY - input.pageTop - renderedH / 2;
  return {
    x: pagePercent(localX / scaleX, input.naturalWidth),
    y: pagePercent(localY / scaleY, input.naturalHeight),
    width: pagePercent(input.widthPx, input.naturalWidth),
    height: pagePercent(input.heightPx, input.naturalHeight),
  };
}

/** Thumbnails follow the last saved PDF, then the file that was opened. */
export function thumbnailPdfUrl(
  documentUrl: string | null,
  savedMarkupUrl: string | null
): string | null {
  return savedMarkupUrl ?? documentUrl;
}

export type MarkupExportTask = {
  toPromise: () => Promise<ArrayBuffer>;
};

/**
 * EmbedPDF 2.15 exports a copy through `forDocument(id).saveAsCopy()`.
 * The older `saveAsCopyAndGetBufferAndName` method is gone.
 */
export function markupExport(
  cap:
    | {
        saveAsCopy?: () => MarkupExportTask;
        forDocument?: (documentId: string) => {
          saveAsCopy: () => MarkupExportTask;
        };
      }
    | null
    | undefined,
  documentId: string | null | undefined
): (() => MarkupExportTask) | null {
  if (!cap) return null;
  if (documentId) {
    const scoped = cap.forDocument?.(documentId)?.saveAsCopy;
    if (scoped) return scoped;
  }
  return cap.saveAsCopy ?? null;
}

/**
 * Pen and highlighter commit on pointer-up. The viewer default waits 800ms,
 * and a reload inside that wait drops the stroke.
 */
export function markupInkTools(): ReadonlyArray<{
  id: "ink" | "inkHighlighter";
  behavior: { commitDelay: 0 };
}> {
  return [
    { id: "ink", behavior: { commitDelay: 0 } },
    { id: "inkHighlighter", behavior: { commitDelay: 0 } },
  ];
}

export type MarkupLeave = "pagehide" | "hidden" | "unmount";

/** A pending upload goes out when the page leaves. Unload uses keepalive so the request survives. */
export function markupLeaveSave(reason: MarkupLeave): {
  flush: true;
  keepalive: boolean;
} {
  return { flush: true, keepalive: reason !== "unmount" };
}

/** Page thumbnails include ink and highlights. The page image alone does not. */
export function thumbnailPageRender(
  scale: number,
  dpr: number
): { scaleFactor: number; dpr: number; withAnnotations: true } {
  return { scaleFactor: scale, dpr, withAnnotations: true };
}

/** One ink for every field. Type does not pick a color. */
export function fieldChrome(): {
  readonly ink: string;
  readonly accent: string;
  readonly glow: string;
} {
  return {
    ink: canvas.chrome.ink,
    accent: canvas.chrome.ink,
    glow: canvas.chrome.shadowUnselected,
  };
}
