/**
 * PDF utilities — PDFium (EmbedPDF engines). SEA-64 + ThumbnailSidebar.
 */

import {
  createPdfiumWorkerEngine,
  type PdfEngine,
} from "@embedpdf/engines/pdfium";
import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";

let engineSingleton: PdfEngine<Blob> | null = null;

function getEngine(): PdfEngine<Blob> {
  if (!engineSingleton) {
    engineSingleton = createPdfiumWorkerEngine(pdfiumWasmUrl);
  }
  return engineSingleton;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to encode thumbnail"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to encode thumbnail"));
    reader.readAsDataURL(blob);
  });
}

async function renderPageDataUrl(
  engine: PdfEngine<Blob>,
  content: ArrayBuffer,
  pageIndex: number,
  maxWidth: number,
  maxHeight: number
): Promise<string | null> {
  const doc = await engine
    .openDocumentBuffer({
      id: `seal-thumb-${crypto.randomUUID()}`,
      content,
    })
    .toPromise();
  try {
    const page = doc.pages[pageIndex];
    if (!page) return null;
    const scale = Math.min(
      maxWidth / page.size.width,
      maxHeight / page.size.height
    );
    const blob = await engine
      .renderPage(doc, page, {
        scaleFactor: scale,
        dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      })
      .toPromise();
    return blobToDataUrl(blob);
  } finally {
    await engine.closeDocument(doc).toPromise();
  }
}

/**
 * Generate thumbnail from PDF URL (first page).
 */
export async function generateThumbnailFromUrl(
  url: string,
  maxWidth = 200,
  maxHeight = 300
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return renderPageDataUrl(
      getEngine(),
      arrayBuffer,
      0,
      maxWidth,
      maxHeight
    );
  } catch (error) {
    console.error("Error generating PDF thumbnail from URL:", error);
    return null;
  }
}

/**
 * Extract page count + first-page thumbnail from a File (upload).
 */
export async function extractPdfMetadata(file: File): Promise<{
  pageCount: number;
  thumbnail: string | null;
}> {
  try {
    const engine = getEngine();
    const content = await file.arrayBuffer();
    const doc = await engine
      .openDocumentBuffer({
        id: `seal-meta-${crypto.randomUUID()}`,
        content,
      })
      .toPromise();
    try {
      const pageCount = doc.pages.length;
      const page = doc.pages[0];
      if (!page) return { pageCount, thumbnail: null };
      const scale = Math.min(200 / page.size.width, 300 / page.size.height);
      const blob = await engine
        .renderPage(doc, page, {
          scaleFactor: scale,
          dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        })
        .toPromise();
      const thumbnail = await blobToDataUrl(blob);
      return { pageCount, thumbnail };
    } finally {
      await engine.closeDocument(doc).toPromise();
    }
  } catch (error) {
    console.error("Error extracting PDF metadata:", error);
    return { pageCount: 0, thumbnail: null };
  }
}

/**
 * Generate per-page thumbnails from a PDF object URL (lazy, bounded).
 * Used by Kumo ThumbnailSidebar — keep small for sidebar density.
 */
export async function generatePageThumbnailsFromUrl(
  url: string,
  options?: {
    maxPages?: number;
    maxWidth?: number;
    maxHeight?: number;
  }
): Promise<Array<{ page: number; src: string }>> {
  const maxPages = options?.maxPages ?? 40;
  const maxWidth = options?.maxWidth ?? 96;
  const maxHeight = options?.maxHeight ?? 128;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const engine = getEngine();
    const content = await response.arrayBuffer();
    const doc = await engine
      .openDocumentBuffer({
        id: `seal-pages-${crypto.randomUUID()}`,
        content,
      })
      .toPromise();

    try {
      const pageLimit = Math.min(doc.pages.length, maxPages);
      const results: Array<{ page: number; src: string }> = [];

      for (let i = 0; i < pageLimit; i++) {
        const page = doc.pages[i];
        if (!page) continue;
        const scale = Math.min(
          maxWidth / page.size.width,
          maxHeight / page.size.height
        );
        const blob = await engine
          .renderPage(doc, page, {
            scaleFactor: scale,
            dpr:
              typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          })
          .toPromise();
        results.push({
          page: page.index + 1,
          src: await blobToDataUrl(blob),
        });
      }

      return results;
    } finally {
      await engine.closeDocument(doc).toPromise();
    }
  } catch (error) {
    console.error("Error generating page thumbnails:", error);
    return [];
  }
}
