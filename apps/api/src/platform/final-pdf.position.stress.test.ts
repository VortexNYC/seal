/**
 * Stress: signature burn-in lands on the field bottom (signature line).
 * Synthetic pages with known horizontal rules; PNG ink flush to bottom row.
 */
import { deflateSync } from "node:zlib";

import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { flattenFieldsIntoPdf } from "./final-pdf.js";
import { percentToPdfRect } from "./pdf-ops.js";

function makeBottomInkPng(width: number, height: number): string {
  // RGBA: transparent except last row solid red (255,0,0,255).
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 4;
      if (y === height - 1) {
        raw[i] = 255;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 255;
      } else {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
      }
    }
  }
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  })();
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++)
      c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function fieldForLineBottom(args: {
  pageWidth: number;
  pageHeight: number;
  /** PDF bottom-left Y of the printed signature rule */
  lineY: number;
  xPct: number;
  widthPct: number;
  heightPts: number;
}): { x: number; y: number; width: number; height: number } {
  const { pageWidth, pageHeight, lineY, xPct, widthPct, heightPts } = args;
  const heightPct = (heightPts / pageHeight) * 100;
  // Field bottom sits on the line: top-left y + height = distance from top to line.
  const topFromTop = pageHeight - lineY;
  const yPct = ((topFromTop - heightPts) / pageHeight) * 100;
  return {
    x: xPct,
    y: yPct,
    width: widthPct,
    height: heightPct,
  };
}

describe("final-pdf position stress", () => {
  it("percentToPdfRect round-trips field bottom to the intended PDF Y", () => {
    const sizes: Array<[number, number]> = [
      [612, 792],
      [648, 826],
      [842, 595], // landscape A4-ish
      [200, 200],
    ];
    for (const [pw, ph] of sizes) {
      for (const lineY of [40, ph / 2, ph - 30]) {
        const f = fieldForLineBottom({
          pageWidth: pw,
          pageHeight: ph,
          lineY,
          xPct: 10,
          widthPct: 40,
          heightPts: 20,
        });
        const r = percentToPdfRect(pw, ph, f.x, f.y, f.width, f.height);
        expect(r.y).toBeCloseTo(lineY, 5);
        expect(r.y + r.height).toBeCloseTo(lineY + (f.height / 100) * ph, 5);
      }
    }
  });

  it("edge and degenerate percent rects stay in page bounds", () => {
    const pw = 648;
    const ph = 826;
    const cases = [
      [0, 0, 10, 5],
      [90, 95, 10, 5],
      [0, 97, 100, 3],
      [50, 50, 0.5, 0.5],
    ] as const;
    for (const [x, y, w, h] of cases) {
      const r = percentToPdfRect(pw, ph, x, y, w, h);
      expect(r.x).toBeGreaterThanOrEqual(-0.01);
      expect(r.y).toBeGreaterThanOrEqual(-0.01);
      expect(r.x + r.width).toBeLessThanOrEqual(pw + 0.01);
      expect(r.y + r.height).toBeLessThanOrEqual(ph + 0.01);
    }
  });

  it("burns bottom-row ink onto known rules across page sizes and aspect ratios", async () => {
    const scenarios: Array<{
      name: string;
      pw: number;
      ph: number;
      lines: number[];
      pngW: number;
      pngH: number;
      heightPts: number;
    }> = [
      {
        name: "letter-tall-field",
        pw: 612,
        ph: 792,
        lines: [120, 400, 700],
        pngW: 200,
        pngH: 40,
        heightPts: 28,
      },
      {
        name: "greenmar-tight",
        pw: 648,
        ph: 826,
        lines: [100, 510, 728],
        pngW: 400,
        pngH: 20,
        heightPts: 14,
      },
      {
        name: "wide-image-letterbox",
        pw: 612,
        ph: 792,
        lines: [300],
        pngW: 800,
        pngH: 20,
        heightPts: 40, // taller field than scaled image → letterbox above
      },
      {
        name: "tall-image-fit-height",
        pw: 612,
        ph: 792,
        lines: [250],
        pngW: 40,
        pngH: 80,
        heightPts: 20, // width-limited? height-limited — ink still at bottom
      },
    ];

    for (const s of scenarios) {
      const doc = await PDFDocument.create();
      const page = doc.addPage([s.pw, s.ph]);
      // Draw black rules at known bottom-left Y for visual/debug
      for (const lineY of s.lines) {
        page.drawLine({
          start: { x: 40, y: lineY },
          end: { x: s.pw - 40, y: lineY },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
      }
      const src = await doc.save();
      const ink = makeBottomInkPng(s.pngW, s.pngH);

      const fields = s.lines.map((lineY, i) => {
        const geom = fieldForLineBottom({
          pageWidth: s.pw,
          pageHeight: s.ph,
          lineY,
          xPct: 15,
          widthPct: 50,
          heightPts: s.heightPts,
        });
        return {
          fieldType: "signature",
          page: 1,
          ...geom,
          value: `sig-${i}`,
          signatureImageUrl: ink,
        };
      });

      // Pure math expectation: drawImage y === rect.y === lineY when
      // bottom-aligned, regardless of letterboxing above.
      for (const f of fields) {
        const rect = percentToPdfRect(s.pw, s.ph, f.x, f.y, f.width, f.height);
        const scale = Math.min(rect.width / s.pngW, rect.height / s.pngH);
        const drawH = s.pngH * scale;
        const drawY = rect.y; // bottom-align
        // Opaque ink is on the last PNG row → at drawY in PDF space
        const inkBottomY = drawY;
        const expectedLine = rect.y;
        expect(
          inkBottomY,
          `${s.name} ink bottom should equal field bottom`
        ).toBeCloseTo(expectedLine, 6);
        expect(drawH).toBeLessThanOrEqual(rect.height + 1e-6);
      }

      const { burnedFields, bytes } = await flattenFieldsIntoPdf(src, fields);
      expect(burnedFields, s.name).toBe(s.lines.length);
      expect(bytes.byteLength).toBeGreaterThan(src.byteLength / 2);
    }
  });

  it("UI top-left percent and burn-in share the same field box", () => {
    // Overlay: top = (y/100)*cssH, height = (h/100)*cssH
    // Burn: rect.y = pageH - (y/100)*pageH - (h/100)*pageH  (bottom-left)
    // Same percentages ⇒ same relative box. Stress across CSS scales.
    const pageH = 826;
    const scales = [1, 1.5, 2.083333]; // 72dpi, 108dpi, 150dpi
    const f = { x: 16.02, y: 58.84, width: 47.3, height: 2.91 };
    const pdfRect = percentToPdfRect(648, pageH, f.x, f.y, f.width, f.height);
    for (const scale of scales) {
      const cssH = pageH * scale;
      const uiTop = (f.y / 100) * cssH;
      const uiBottom = uiTop + (f.height / 100) * cssH;
      // Convert UI bottom (from top) to PDF bottom-left Y
      const uiBottomAsPdfY = pageH - uiBottom / scale;
      expect(uiBottomAsPdfY).toBeCloseTo(pdfRect.y, 4);
    }
  });

  it("documents float when signature PNG has transparent bottom padding", () => {
    // Without trim, burn-in bottom-aligns the IMAGE box — transparent pad ⇒ visual float.
    const pw = 612;
    const ph = 792;
    const lineY = 400;
    const heightPts = 40;
    const pngW = 200;
    const pngH = 40;
    const padRows = 8;
    const f = fieldForLineBottom({
      pageWidth: pw,
      pageHeight: ph,
      lineY,
      xPct: 15,
      widthPct: 50,
      heightPts,
    });
    const rect = percentToPdfRect(pw, ph, f.x, f.y, f.width, f.height);
    const scale = Math.min(rect.width / pngW, rect.height / pngH);
    const inkBottomY = rect.y + padRows * scale;
    expect(rect.y).toBeCloseTo(lineY, 6);
    expect(inkBottomY - lineY).toBeCloseTo(padRows * scale, 6);
    expect(inkBottomY).toBeGreaterThan(lineY);
  });

  it("trimTransparentPng removes the float before burn-in", async () => {
    const { trimTransparentPng } = await import("./png-trim.js");
    const { deflateSync } = await import("node:zlib");

    function makePadded(width: number, height: number, pad: number): Uint8Array {
      const raw = Buffer.alloc((width * 4 + 1) * height);
      const inkY = height - 1 - pad;
      for (let y = 0; y < height; y++) {
        const rs = y * (width * 4 + 1);
        raw[rs] = 0;
        for (let x = 0; x < width; x++) {
          const i = rs + 1 + x * 4;
          if (y === inkY) {
            raw[i] = 20;
            raw[i + 1] = 40;
            raw[i + 2] = 180;
            raw[i + 3] = 255;
          }
        }
      }
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
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(width, 0);
      ihdr.writeUInt32BE(height, 4);
      ihdr[8] = 8;
      ihdr[9] = 6;
      return new Uint8Array(
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          chunk("IHDR", ihdr),
          chunk("IDAT", deflateSync(raw)),
          chunk("IEND", Buffer.alloc(0)),
        ])
      );
    }

    const trimmed = trimTransparentPng(makePadded(100, 40, 8));
    const height =
      (trimmed[20]! << 24) |
      (trimmed[21]! << 16) |
      (trimmed[22]! << 8) |
      trimmed[23]!;
    expect(height).toBe(1);
  });
});
