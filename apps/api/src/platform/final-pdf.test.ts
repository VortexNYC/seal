import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  finalPdfStorageKey,
  flattenFieldsIntoPdf,
  sanitizePdfText,
  sha256PdfBytes,
} from "./final-pdf.js";

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText("Contract", { x: 50, y: 740, size: 14, color: rgb(0, 0, 0) });
  return doc.save();
}

/** 1x1 transparent PNG */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("final-pdf (SEA-49 L1a)", () => {
  it("builds a stable signed storage key", () => {
    expect(finalPdfStorageKey("org_1", "doc_2")).toBe("signed/org_1/doc_2.pdf");
  });

  it("sanitizes non-WinAnsi glyphs", () => {
    expect(sanitizePdfText("NDA — Acme ↔ Vortex")).toBe("NDA ? Acme <-> Vortex");
  });

  it("hashes PDF bytes stably", async () => {
    const bytes = await makePdf();
    const a = await sha256PdfBytes(bytes);
    const b = await sha256PdfBytes(bytes);
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
    expect(a.length).toBe("sha256:".length + 64);
  });

  it("burns signature image + text + checkbox into the PDF", async () => {
    const src = await makePdf();
    const before = await sha256PdfBytes(src);
    const { bytes, documentHash, burnedFields } = await flattenFieldsIntoPdf(
      src,
      [
        {
          fieldType: "signature",
          page: 1,
          x: 10,
          y: 70,
          width: 30,
          height: 8,
          value: null,
          signatureImageUrl: TINY_PNG,
        },
        {
          fieldType: "text",
          page: 1,
          x: 10,
          y: 60,
          width: 40,
          height: 4,
          value: "Alice Signer",
          signatureImageUrl: null,
        },
        {
          fieldType: "checkbox",
          page: 1,
          x: 10,
          y: 50,
          width: 3,
          height: 3,
          value: "true",
          signatureImageUrl: null,
        },
        {
          fieldType: "checkbox",
          page: 1,
          x: 20,
          y: 50,
          width: 3,
          height: 3,
          value: "false",
          signatureImageUrl: null,
        },
      ]
    );

    expect(burnedFields).toBe(3);
    expect(documentHash).not.toBe(before);
    expect(documentHash).toBe(await sha256PdfBytes(bytes));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("skips empty fields without failing", async () => {
    const src = await makePdf();
    const { burnedFields, documentHash, bytes } = await flattenFieldsIntoPdf(
      src,
      [
        {
          fieldType: "text",
          page: 1,
          x: 10,
          y: 10,
          width: 20,
          height: 4,
          value: null,
          signatureImageUrl: null,
        },
      ]
    );
    expect(burnedFields).toBe(0);
    expect(documentHash).toBe(await sha256PdfBytes(bytes));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
