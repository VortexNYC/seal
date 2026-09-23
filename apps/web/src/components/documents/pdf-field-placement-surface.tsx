import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import type { PdfDocumentObject } from "@embedpdf/models";
import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { useTransformContext } from "react-zoom-pan-pinch";

import { cn } from "@/lib/utils";

import type { PlacedField } from "./draggable-field";
import { PdfCanvasLayer } from "./pdf-canvas-layer";

export type PdfFieldPlacementSurfaceProps = {
  /** Object URL or remote URL for the PDF bytes. */
  src: string | null;
  pageNumber: number;
  width: number;
  className?: string;
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
  onDocumentLoadSuccess?: (info: { numPages: number }) => void;
  onPageDimensions?: (
    pageNumber: number,
    width: number,
    height: number
  ) => void;
  onPageRef?: (pageNumber: number, element: HTMLDivElement | null) => void;
};

/**
 * Field placement surface — PDFium page raster (strongest engine) + Konva field layer.
 * Does not use react-pdf. Seal e-sign field model stays Konva; PDF fidelity is PDFium.
 */
export function PdfFieldPlacementSurface({
  src,
  pageNumber,
  width,
  className,
  fields,
  selectedFieldId,
  onFieldSelect,
  onFieldUpdate,
  onDocumentLoadSuccess,
  onPageDimensions,
  onPageRef,
}: PdfFieldPlacementSurfaceProps): JSX.Element {
  const { engine, isLoading: engineLoading, error: engineError } =
    usePdfiumEngine({
      wasmUrl: pdfiumWasmUrl,
      worker: true,
    });

  const [doc, setDoc] = useState<PdfDocumentObject | null>(null);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const pageImageUrlRef = useRef<string | null>(null);
  const docRef = useRef<PdfDocumentObject | null>(null);
  const onLoadRef = useRef(onDocumentLoadSuccess);
  const onDimsRef = useRef(onPageDimensions);
  onLoadRef.current = onDocumentLoadSuccess;
  onDimsRef.current = onPageDimensions;

  const transformContext = useTransformContext();
  const { positionX, positionY } = transformContext?.transformState || {
    positionX: 0,
    positionY: 0,
  };

  useEffect(() => {
    if (!engine || !src) return;
    let cancelled = false;

    void (async () => {
      setStatus("loading");
      try {
        const response = await fetch(src);
        const content = await response.arrayBuffer();
        if (cancelled) return;

        if (docRef.current) {
          await engine.closeDocument(docRef.current).toPromise();
          docRef.current = null;
        }

        const opened = await engine
          .openDocumentBuffer({
            id: `seal-fields-${crypto.randomUUID()}`,
            content,
          })
          .toPromise();
        if (cancelled) {
          await engine.closeDocument(opened).toPromise();
          return;
        }
        docRef.current = opened;
        setDoc(opened);
        onLoadRef.current?.({ numPages: opened.pages.length });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
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
      if (pageImageUrlRef.current) {
        URL.revokeObjectURL(pageImageUrlRef.current);
        pageImageUrlRef.current = null;
      }
    };
  }, [engine]);

  useEffect(() => {
    if (!engine || !doc) return;
    const page = doc.pages[pageNumber - 1];
    if (!page) return;

    let cancelled = false;
    void (async () => {
      setStatus("loading");
      try {
        const scaleFactor = width / page.size.width;
        const renderedHeight = page.size.height * scaleFactor;
        const blob = await engine
          .renderPage(doc, page, {
            scaleFactor,
            dpr:
              typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          })
          .toPromise();

        if (cancelled) return;

        if (pageImageUrlRef.current) {
          URL.revokeObjectURL(pageImageUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        pageImageUrlRef.current = url;
        setPageImageUrl(url);
        setPageSize({ width, height: renderedHeight });
        onDimsRef.current?.(pageNumber, width, renderedHeight);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [engine, doc, pageNumber, width]);

  if (!src) {
    return (
      <div className="text-muted-foreground p-16 text-center text-sm">
        No PDF loaded
      </div>
    );
  }

  if (engineError || status === "error") {
    return (
      <div className="text-destructive p-16 text-center text-sm">
        Failed to load document
      </div>
    );
  }

  if (engineLoading || status === "loading" || !pageImageUrl || !pageSize) {
    return (
      <div className="text-muted-foreground p-16 text-center">
        <div className="animate-pulse">Loading document…</div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative", className)}
      ref={(el) => onPageRef?.(pageNumber, el)}
      data-page-number={pageNumber}
      data-engine="pdfium"
    >
      <img
        src={pageImageUrl}
        alt=""
        width={pageSize.width}
        height={pageSize.height}
        className="block select-none"
        draggable={false}
      />
      <PdfCanvasLayer
        pageNumber={pageNumber}
        pdfWidth={pageSize.width}
        pdfHeight={pageSize.height}
        scrollOffset={{ x: positionX, y: positionY }}
        fields={fields}
        selectedFieldId={selectedFieldId}
        onFieldSelect={onFieldSelect}
        onFieldUpdate={onFieldUpdate}
      />
    </div>
  );
}
