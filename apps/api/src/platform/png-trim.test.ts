import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { flattenFieldsIntoPdf } from "./final-pdf.js";
import { percentToPdfRect } from "./pdf-ops.js";
import { trimTransparentPng } from "./png-trim.js";
import { PDFDocument, rgb } from "pdf-lib";

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** RGBA PNG with optional transparent padding below a solid red ink row. */
function makePng(width: number, height: number, inkRowFromBottom: number): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const inkY = height - 1 - inkRowFromBottom;
  for (let y = 0; y < height; y++) {
    const rs = y * (width * 4 + 1);
    raw[rs] = 0;
    for (let x = 0; x < width; x++) {
      const i = rs + 1 + x * 4;
      if (y === inkY) {
        raw[i] = 255;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("png-trim + burn-in (DocuSeal-class crop)", () => {
  it("trims transparent bottom padding from PNG bytes", () => {
    const padded = makePng(40, 20, 5); // ink 5 rows above bottom
    const trimmed = trimTransparentPng(new Uint8Array(padded));
    expect(trimmed.byteLength).toBeGreaterThan(0);
    expect(trimmed.byteLength).toBeLessThan(padded.byteLength);
    // IHDR: sig(8) + len(4) + "IHDR"(4) + width(4) + height(4)
    const height =
      (trimmed[20]! << 24) |
      (trimmed[21]! << 16) |
      (trimmed[22]! << 8) |
      trimmed[23]!;
    expect(height).toBe(1);
  });

  it("burn-in places trimmed ink on the field bottom even when source PNG was padded", async () => {
    const pw = 612;
    const ph = 792;
    const lineY = 400;
    const heightPts = 40;
    const doc = await PDFDocument.create();
    const page = doc.addPage([pw, ph]);
    page.drawLine({
      start: { x: 40, y: lineY },
      end: { x: pw - 40, y: lineY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    const src = await doc.save();

    const padded = makePng(200, 40, 8);
    const dataUrl = `data:image/png;base64,${Buffer.from(padded).toString("base64")}`;
    const heightPct = (heightPts / ph) * 100;
    const yPct = ((ph - lineY - heightPts) / ph) * 100;

    const { burnedFields } = await flattenFieldsIntoPdf(src, [
      {
        fieldType: "signature",
        page: 1,
        x: 15,
        y: yPct,
        width: 50,
        height: heightPct,
        value: null,
        signatureImageUrl: dataUrl,
      },
    ]);
    expect(burnedFields).toBe(1);

    // After trim, ink row is the only row → drawH scales to fit; bottom == rect.y == lineY
    const rect = percentToPdfRect(pw, ph, 15, yPct, 50, heightPct);
    expect(rect.y).toBeCloseTo(lineY, 5);
  });
});
