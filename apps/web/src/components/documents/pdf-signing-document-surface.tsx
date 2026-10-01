import { usePdfiumEngine } from "@embedpdf/engines/react";
import type { PdfDocumentObject } from "@embedpdf/models";
import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PdfSigningPageContext = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  numPages: number;
};

export type PdfSigningDocumentSurfaceProps = {
  src: string | null;
  width: number;
  className?: string;
  onDocumentLoadSuccess?: (info: { numPages: number }) => void;
  /** Overlays (fillable fields) rendered per page on top of the PDFium raster. */
  renderPageOverlays?: (ctx: PdfSigningPageContext) => ReactNode;
};

type PageRaster = {
  pageNumber: number;
  url: string;
  width: number;
  height: number;
};

/**
 * Multi-page signing surface — PDFium rasters + Seal fillable overlays.
 *
 * SEA-74: use the direct (main-thread) engine. EmbedPDF's worker build boots
 * from a blob: URL (opaque origin); fetching /assets/*.wasm from that worker
 * is cross-origin and fails without CORS, so the engine never goes ready and
 * the signer stays on an empty white surface. Direct mode loads wasm from the
 * page origin and paints.
 *
 * Progressive paint: long packets (50+ pages) used to block on "Loading
 * document…" until every page finished rasterizing. Paint each page as it
 * completes so signers can reach mid-document fields immediately.
 */
export function PdfSigningDocumentSurface({
  src,
  width,
  className,
  onDocumentLoadSuccess,
  renderPageOverlays,
}: PdfSigningDocumentSurfaceProps): JSX.Element {
  const {
    engine,
    isLoading: engineLoading,
    error: engineError,
  } = usePdfiumEngine({
    wasmUrl: pdfiumWasmUrl,
    worker: false,
  });

  const [doc, setDoc] = useState<PdfDocumentObject | null>(null);
  const [pages, setPages] = useState<PageRaster[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [isRasterizing, setIsRasterizing] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const docRef = useRef<PdfDocumentObject | null>(null);
  const pageUrlsRef = useRef<string[]>([]);
  const hasPaintedRef = useRef(false);
  const onLoadRef = useRef(onDocumentLoadSuccess);
  onLoadRef.current = onDocumentLoadSuccess;

  useEffect(() => {
    if (!engine || !src) return;
    let cancelled = false;

    void (async () => {
      setStatus("loading");
      setLoadError(null);
      setPages([]);
      setNumPages(0);
      hasPaintedRef.current = false;
      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`PDF fetch failed (${response.status})`);
        }
        const content = await response.arrayBuffer();
        if (cancelled) return;

        if (docRef.current) {
          await engine.closeDocument(docRef.current).toPromise();
          docRef.current = null;
        }
        for (const url of pageUrlsRef.current) {
          URL.revokeObjectURL(url);
        }
        pageUrlsRef.current = [];

        const opened = await engine
          .openDocumentBuffer({
            id: `seal-sign-${crypto.randomUUID()}`,
            content,
          })
          .toPromise();
        if (cancelled) {
          await engine.closeDocument(opened).toPromise();
          return;
        }
        docRef.current = opened;
        setDoc(opened);
        setNumPages(opened.pages.length);
        onLoadRef.current?.({ numPages: opened.pages.length });
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setLoadError(
            err instanceof Error ? err.message : "Failed to open PDF"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [engine, src]);

  useEffect(() => {
    return () => {
      const current = docRef.current;
      if (current && engine) {
        void engine.closeDocument(current).toPromise();
        docRef.current = null;
      }
      for (const url of pageUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      pageUrlsRef.current = [];
    };
  }, [engine]);

  useEffect(() => {
    if (!engine || !doc) return;
    let cancelled = false;

    void (async () => {
      // Keep prior rasters visible while re-painting on width change so
      // portrait/resize does not flash back to a full-page skeleton.
      if (!hasPaintedRef.current) {
        setStatus("loading");
      }
      setIsRasterizing(true);
      setLoadError(null);
      try {
        const dpr =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const rasters: PageRaster[] = [];
        const newUrls: string[] = [];
        const previousUrls = pageUrlsRef.current;

        for (const page of doc.pages) {
          if (cancelled) return;
          const scaleFactor = width / page.size.width;
          const renderedHeight = page.size.height * scaleFactor;
          const blob = await engine
            .renderPage(doc, page, { scaleFactor, dpr })
            .toPromise();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          newUrls.push(url);
          rasters.push({
            pageNumber: page.index + 1,
            url,
            width,
            height: renderedHeight,
          });
          // Progressive: first page unlocks the surface; later pages append.
          hasPaintedRef.current = true;
          setPages([...rasters]);
          setStatus("ready");
          pageUrlsRef.current = [...newUrls];
        }

        if (cancelled) {
          for (const url of newUrls) URL.revokeObjectURL(url);
          return;
        }

        for (const url of previousUrls) {
          if (!newUrls.includes(url)) {
            URL.revokeObjectURL(url);
          }
        }
        pageUrlsRef.current = newUrls;
        setPages(rasters);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setLoadError(
            err instanceof Error ? err.message : "Failed to render PDF"
          );
        }
      } finally {
        if (!cancelled) {
          setIsRasterizing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [engine, doc, width]);

  if (!src) {
    return (
      <div className="text-muted-foreground p-16 text-center text-sm">
        No PDF loaded
      </div>
    );
  }

  if (engineError || status === "error") {
    return (
      <div
        className="border-kumo-danger/30 bg-kumo-elevated rounded-lg border p-16 text-center shadow-sm"
        role="alert"
        data-testid="pdf-signing-error"
      >
        <p className="text-kumo-danger font-medium">Failed to load PDF</p>
        <p className="text-kumo-secondary mt-1 text-sm">
          {loadError ??
            engineError?.message ??
            "Please try refreshing the page"}
        </p>
      </div>
    );
  }

  if (engineLoading || (status === "loading" && pages.length === 0)) {
    return (
      <div
        className="border-kumo-hairline/50 bg-kumo-elevated rounded-lg border p-16 text-center shadow-sm"
        role="status"
        aria-live="polite"
        data-testid="pdf-signing-loading"
      >
        <p className="text-kumo-secondary mb-4 text-sm">Loading document…</p>
        <div className="animate-pulse space-y-4">
          <div className="bg-kumo-hairline mx-auto h-4 w-1/3 rounded" />
          <div className="bg-kumo-hairline mx-auto h-4 w-1/2 rounded" />
          <div className="bg-kumo-hairline mx-auto h-4 w-2/5 rounded" />
        </div>
      </div>
    );
  }

  const totalPages = numPages > 0 ? numPages : pages.length;

  return (
    <div
      data-kumo-docs="pdf-signing-document"
      data-engine="pdfium"
      data-testid="pdf-signing-document"
      className={cn("space-y-4", className)}
    >
      {pages.map((page) => (
        <div
          key={`page_${page.pageNumber}`}
          data-page-number={page.pageNumber}
          data-testid={`pdf-signing-page-${page.pageNumber}`}
          className="border-kumo-hairline/50 bg-kumo-elevated relative mb-4 overflow-hidden rounded-lg border shadow-sm last:mb-0"
        >
          <img
            src={page.url}
            alt=""
            width={page.width}
            height={page.height}
            className="mx-auto block select-none"
            draggable={false}
          />
          {renderPageOverlays?.({
            pageNumber: page.pageNumber,
            pageWidth: page.width,
            pageHeight: page.height,
            numPages: totalPages,
          })}
          {totalPages > 1 ? (
            // vortex-allow-color: signing-view scrim dims content uniformly in both themes
            <div className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
              {page.pageNumber} / {totalPages}
            </div>
          ) : null}
        </div>
      ))}
      {isRasterizing && pages.length < totalPages ? (
        <div
          className="text-kumo-secondary py-2 text-center text-xs"
          role="status"
          aria-live="polite"
          data-testid="pdf-signing-pages-loading"
        >
          Loading pages {pages.length}/{totalPages}…
        </div>
      ) : null}
    </div>
  );
}
