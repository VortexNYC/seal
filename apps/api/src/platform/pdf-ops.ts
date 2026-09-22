import {
  PDFDocument,
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

