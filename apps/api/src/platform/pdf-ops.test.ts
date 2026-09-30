import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  annotatePdf,
  getPdfPageCount,
  organizePdfPages,
  percentToPdfRect,
  splitPdfPages,
} from "./pdf-ops.js";

async function makePdf(pages = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 12, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

describe("pdf-ops", () => {
  it("maps percent rect into page bounds", () => {
    const r = percentToPdfRect(612, 792, 10, 10, 20, 5);
    expect(r.x).toBeCloseTo(61.2, 0);
    expect(r.width).toBeCloseTo(122.4, 0);
    expect(r.y + r.height).toBeLessThanOrEqual(792);
  });

  it("splits selected pages", async () => {
    const src = await makePdf(4);
    const { bytes, pageCount } = await splitPdfPages(src, [2, 4]);
    expect(pageCount).toBe(2);
    expect(await getPdfPageCount(bytes)).toBe(2);
  });

  it("annotates without changing page count", async () => {
    const src = await makePdf(2);
    const out = await annotatePdf(src, [
      {
        op: "highlight",
        page: 1,
        x: 10,
        y: 20,
        width: 40,
        height: 5,
      },
      { op: "text", page: 2, x: 10, y: 30, text: "Agent note" },
    ]);
    expect(await getPdfPageCount(out)).toBe(2);
  });

  it("reorders and deletes pages in one pass", async () => {
    const src = await makePdf(4);
    const { bytes, pageCount, pageMap } = await organizePdfPages(src, [
      4, 1, 2,
    ]);
    expect(pageCount).toBe(3);
    expect(await getPdfPageCount(bytes)).toBe(3);
    expect(pageMap.get(4)).toBe(1);
    expect(pageMap.get(1)).toBe(2);
    expect(pageMap.get(2)).toBe(3);
    expect(pageMap.has(3)).toBe(false);
  });

  it("rejects duplicate page order entries", async () => {
    const src = await makePdf(3);
    await expect(organizePdfPages(src, [1, 1, 2])).rejects.toThrow(
      "duplicate_pages"
    );
  });
});
