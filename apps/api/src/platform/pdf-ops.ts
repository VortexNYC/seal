import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  type RGB,
} from "pdf-lib";
import { z } from "zod";

/** Percent-of-page (0–100) → PDF points (origin bottom-left). */
export function percentToPdfRect(
  pageWidth: number,
  pageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const w = (width / 100) * pageWidth;
  const h = (height / 100) * pageHeight;
  const px = (x / 100) * pageWidth;
  const py = pageHeight - (y / 100) * pageHeight - h;
  return { x: px, y: py, width: w, height: h };
}

export const pdfAnnotateOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("highlight"),
    page: z.number().int().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string().optional(),
  }),
  z.object({
    op: z.literal("text"),
    page: z.number().int().min(1),
    x: z.number(),
    y: z.number(),
    text: z.string().min(1).max(2000),
    size: z.number().optional(),
    color: z.string().optional(),
  }),
  z.object({
    op: z.literal("rect"),
    page: z.number().int().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string().optional(),
  }),
  z.object({
    op: z.literal("redact"),
    page: z.number().int().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
]);

export type PdfAnnotateOp = z.infer<typeof pdfAnnotateOpSchema>;

function parseColor(hex: string | undefined, fallback: RGB): RGB {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return fallback;
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Apply annotation/draw operations onto a PDF. Returns new PDF bytes.
 */
export async function annotatePdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  ops: PdfAnnotateOp[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const op of ops) {
    const page = pages[op.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    if (op.op === "highlight") {
      const r = percentToPdfRect(pw, ph, op.x, op.y, op.width, op.height);
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color: parseColor(op.color, rgb(1, 0.95, 0.4)),
        opacity: 0.35,
        borderWidth: 0,
      });
    } else if (op.op === "rect") {
      const r = percentToPdfRect(pw, ph, op.x, op.y, op.width, op.height);
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        borderColor: parseColor(op.color, rgb(0.2, 0.4, 0.9)),
        borderWidth: 1.5,
        opacity: 0.9,
      });
    } else if (op.op === "redact") {
      const r = percentToPdfRect(pw, ph, op.x, op.y, op.width, op.height);
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color: rgb(0, 0, 0),
        borderWidth: 0,
      });
    } else if (op.op === "text") {
      const size = op.size ?? 11;
      const r = percentToPdfRect(pw, ph, op.x, op.y, 40, 4);
      page.drawText(op.text, {
        x: r.x,
        y: r.y,
        size,
        font,
        color: parseColor(op.color, rgb(0.1, 0.1, 0.1)),
        maxWidth: pw - r.x - 12,
      });
    }
  }

  return doc.save();
}

/**
 * Extract selected 1-based pages into a new PDF.
 */
export async function splitPdfPages(
  pdfBytes: ArrayBuffer | Uint8Array,
  pages: number[]
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const src = await PDFDocument.load(pdfBytes);
  const srcCount = src.getPageCount();
  const unique = [...new Set(pages)].filter((p) => p >= 1 && p <= srcCount);
  if (unique.length === 0) {
    throw new Error("no_valid_pages");
  }
  unique.sort((a, b) => a - b);

  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    unique.map((p) => p - 1)
  );
  for (const page of copied) {
    out.addPage(page);
  }
  const bytes = await out.save();
  return { bytes, pageCount: unique.length };
}

export async function getPdfPageCount(
  pdfBytes: ArrayBuffer | Uint8Array
): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

/**
 * Merge multiple PDFs in order into one document.
 */
export async function mergePdfs(
  pdfBuffers: Array<ArrayBuffer | Uint8Array>
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (pdfBuffers.length === 0) {
    throw new Error("no_pdfs");
  }
  const out = await PDFDocument.create();
  for (const buffer of pdfBuffers) {
    const src = await PDFDocument.load(buffer);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) {
      out.addPage(page);
    }
  }
  const bytes = await out.save();
  return { bytes, pageCount: out.getPageCount() };
}

/**
 * Rotate selected 1-based pages by 90/180/270 degrees clockwise.
 * Empty `pages` rotates every page.
 */
export async function rotatePdfPages(
  pdfBytes: ArrayBuffer | Uint8Array,
  amount: 90 | 180 | 270,
  pages?: number[]
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const doc = await PDFDocument.load(pdfBytes);
  const count = doc.getPageCount();
  const targets =
    pages && pages.length > 0
      ? [...new Set(pages)].filter((p) => p >= 1 && p <= count)
      : Array.from({ length: count }, (_, i) => i + 1);
  if (targets.length === 0) {
    throw new Error("no_valid_pages");
  }
  for (const pageNum of targets) {
    const page = doc.getPage(pageNum - 1);
    const current = page.getRotation().angle;
    const next = ((current + amount) % 360) as 0 | 90 | 180 | 270;
    page.setRotation(degrees(next));
  }
  const bytes = await doc.save();
  return { bytes, pageCount: count };
}

/**
 * Rebuild a PDF from an ordered list of 1-based source page numbers.
 * Omit a page to delete it; permute to reorder. No duplicates allowed.
 * Returns bytes plus oldPage → newPage map for remapping fields.
 */
export async function organizePdfPages(
  pdfBytes: ArrayBuffer | Uint8Array,
  pageOrder: number[]
): Promise<{
  bytes: Uint8Array;
  pageCount: number;
  pageMap: Map<number, number>;
}> {
  const src = await PDFDocument.load(pdfBytes);
  const srcCount = src.getPageCount();
  if (pageOrder.length === 0) {
    throw new Error("no_valid_pages");
  }
  if (pageOrder.length !== new Set(pageOrder).size) {
    throw new Error("duplicate_pages");
  }
  for (const page of pageOrder) {
    if (!Number.isInteger(page) || page < 1 || page > srcCount) {
      throw new Error("no_valid_pages");
    }
  }

  const pageMap = new Map<number, number>();
  pageOrder.forEach((oldPage, index) => {
    pageMap.set(oldPage, index + 1);
  });

  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    pageOrder.map((page) => page - 1)
  );
  for (const page of copied) {
    out.addPage(page);
  }
  const bytes = await out.save();
  return { bytes, pageCount: pageOrder.length, pageMap };
}

/** Helvetica/WinAnsi-safe text for pdf-lib stamps. */
function sanitizeStampText(value: string): string {
  return value
    .replace(/\u2194/g, "<->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function resolvePageTargets(
  count: number,
  pages?: number[]
): number[] {
  const targets =
    pages && pages.length > 0
      ? [...new Set(pages)].filter((p) => p >= 1 && p <= count)
      : Array.from({ length: count }, (_, i) => i + 1);
  if (targets.length === 0) {
    throw new Error("no_valid_pages");
  }
  return targets;
}

export type WatermarkPdfOptions = {
  text: string;
  /** 0–1, default 0.22 */
  opacity?: number;
  position?: "diagonal" | "center" | "footer";
  color?: string;
  /** Font size in points; defaults by position */
  size?: number;
  /** 1-based pages; omit for all */
  pages?: number[];
};

/**
 * Stamp a text watermark onto selected pages of a draft PDF.
 */
export async function watermarkPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  options: WatermarkPdfOptions
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const text = sanitizeStampText(options.text.trim());
  if (text.length === 0) {
    throw new Error("empty_watermark");
  }
  if (text.length > 120) {
    throw new Error("watermark_too_long");
  }

  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const count = doc.getPageCount();
  const targets = resolvePageTargets(count, options.pages);
  const opacity = Math.min(1, Math.max(0.05, options.opacity ?? 0.22));
  const position = options.position ?? "diagonal";
  const color = parseColor(options.color, rgb(0.55, 0.55, 0.55));

  for (const pageNum of targets) {
    const page = doc.getPage(pageNum - 1);
    const { width: pw, height: ph } = page.getSize();
    const size =
      options.size ??
      (position === "footer" ? 10 : Math.min(72, Math.max(28, pw * 0.08)));
    const textWidth = font.widthOfTextAtSize(text, size);

    if (position === "footer") {
      page.drawText(text, {
        x: Math.max(24, (pw - textWidth) / 2),
        y: 28,
        size,
        font,
        color,
        opacity,
      });
    } else if (position === "center") {
      page.drawText(text, {
        x: Math.max(24, (pw - textWidth) / 2),
        y: ph / 2 - size / 2,
        size,
        font,
        color,
        opacity,
      });
    } else {
      // Diagonal across the page center.
      page.drawText(text, {
        x: pw / 2 - textWidth / 2,
        y: ph / 2 - size / 2,
        size,
        font,
        color,
        opacity,
        rotate: degrees(-35),
      });
    }
  }

  const bytes = await doc.save();
  return { bytes, pageCount: count };
}

export type NumberPdfPagesOptions = {
  /** `n` → "1"; `n_of_m` → "1 of 12". Default `n_of_m`. */
  format?: "n" | "n_of_m";
  position?: "footer-center" | "footer-right" | "footer-left";
  /** Display number for the first stamped page (default 1). */
  startAt?: number;
  prefix?: string;
  size?: number;
  color?: string;
  /** 1-based pages; omit for all */
  pages?: number[];
};

/**
 * Stamp page numbers onto a draft PDF (footer by default).
 */
export async function numberPdfPages(
  pdfBytes: ArrayBuffer | Uint8Array,
  options: NumberPdfPagesOptions = {}
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const count = doc.getPageCount();
  const targets = resolvePageTargets(count, options.pages);
  const format = options.format ?? "n_of_m";
  const position = options.position ?? "footer-center";
  const startAt = options.startAt ?? 1;
  const prefix = sanitizeStampText(options.prefix ?? "");
  const size = options.size ?? 10;
  const color = parseColor(options.color, rgb(0.25, 0.25, 0.25));

  for (let i = 0; i < targets.length; i++) {
    const pageNum = targets[i];
    if (pageNum === undefined) continue;
    const page = doc.getPage(pageNum - 1);
    const { width: pw } = page.getSize();
    const display = startAt + i;
    const body =
      format === "n" ? String(display) : `${display} of ${count}`;
    const label = sanitizeStampText(
      prefix.length > 0 ? `${prefix}${body}` : body
    );
    const textWidth = font.widthOfTextAtSize(label, size);
    const margin = 36;
    const x =
      position === "footer-left"
        ? margin
        : position === "footer-right"
          ? Math.max(margin, pw - margin - textWidth)
          : Math.max(margin, (pw - textWidth) / 2);

    page.drawText(label, {
      x,
      y: 24,
      size,
      font,
      color,
      opacity: 0.9,
    });
  }

  const bytes = await doc.save();
  return { bytes, pageCount: count };
}

