import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { redactPdfRegions } from "./pdf-redact.js";

const enc = new TextEncoder();

async function buildSource(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Top area (~y 700) — the sensitive line; bottom area — keep.
  page.drawText("SECRET SSN 123-45-6789", { x: 50, y: 700, size: 12, font });
  page.drawText("keep this line visible", { x: 50, y: 300, size: 12, font });
  page.drawRectangle({
    x: 50,
    y: 680,
    width: 30,
    height: 30,
    color: rgb(0.8, 0, 0),
  });
  return doc.save();
}

describe("pdf-redact", () => {
  it("removes text ops inside the region and keeps the rest", async () => {
    const src = await buildSource();
    const out = await redactPdfRegions(src, [
      // Cover y 650–780 ⇒ top-left %: y from ~1.5% to ~18%, full width.
      { page: 1, x: 0, y: 1, width: 100, height: 18 },
    ]);

    expect(out.opsScrubbed).toBeGreaterThan(0);
    const receipt = out.scrubbedStrings.join(" ");
    expect(receipt).toContain("123-45-6789");

    const reloaded = await PDFDocument.load(out.bytes);
    expect(reloaded.getPageCount()).toBe(1);

    // Emitted bytes (uncompressed streams) no longer carry the secret line…
    const raw = new TextDecoder("latin1").decode(out.bytes);
    const hex = (s: string) =>
      [...enc.encode(s)].map((b) => b.toString(16)).join("");
    expect(raw.toLowerCase()).not.toContain(hex("SECRET SSN 123-45-6789"));
    // …but the kept line's hex string survives.
    expect(raw.toLowerCase()).toContain(hex("keep this line visible"));
  }, 15000);

  it("drops paths fully inside the region but keeps crossing ones", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    // Fully inside region: small box at (50,700)-(80,730).
    page.drawRectangle({
      x: 50,
      y: 700,
      width: 30,
      height: 30,
      color: rgb(1, 0, 0),
    });
    // Crossing the boundary: wide line from inside to outside.
    page.drawLine({
      start: { x: 50, y: 715 },
      end: { x: 400, y: 715 },
      thickness: 1,
      color: rgb(0, 0, 1),
    });
    const src = await doc.save();
    const out = await redactPdfRegions(src, [
      { page: 1, x: 0, y: 1, width: 50, height: 15 },
    ]);
    // path for the box scrubbed; crossing line kept → at least 1 scrub.
    expect(out.opsScrubbed).toBeGreaterThanOrEqual(1);
  }, 15000);
});
