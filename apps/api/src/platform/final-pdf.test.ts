import { PDFDocument, PDFDict, PDFName, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  fieldBurnText,
  finalPdfStorageKey,
  isTruthyCheckbox,
  flattenFieldsIntoPdf,
  layoutFieldText,
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

  it("burns field text in Hedvig Letters Sans", async () => {
    const src = await makePdf();
    const { bytes } = await flattenFieldsIntoPdf(src, [
      {
        fieldType: "text",
        page: 1,
        x: 10,
        y: 40,
        width: 40,
        height: 4,
        value: "Agreed",
        signatureImageUrl: null,
      },
    ]);
    const pdf = await PDFDocument.load(bytes);
    const names: string[] = [];
    for (const [, object] of pdf.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFDict)) continue;
      const base = object.lookup(PDFName.of("BaseFont"));
      if (base) names.push(base.toString());
    }
    expect(names.join(" ")).toContain("HedvigLettersSans");
  });

  it("burns a date and an email without failing", async () => {
    const src = await makePdf();
    const { bytes, burnedFields } = await flattenFieldsIntoPdf(src, [
      {
        fieldType: "date",
        page: 1,
        x: 10,
        y: 40,
        width: 12,
        height: 3.5,
        value: "2026-10-06T04:00:00.000Z",
        signatureImageUrl: null,
      },
      {
        fieldType: "email",
        page: 1,
        x: 10,
        y: 30,
        width: 12,
        height: 3.5,
        value: "seal-e2e@seal.nyc",
        signatureImageUrl: null,
      },
    ]);
    expect(burnedFields).toBe(2);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("shrinks a long value until it fits the box", () => {
    const widthAt = (text: string, size: number) => text.length * size * 0.5;
    const layout = layoutFieldText(
      { widthOfTextAtSize: widthAt },
      "seal-e2e@seal.nyc",
      70,
      24
    );
    const widest = Math.max(
      ...layout.lines.map((line) => widthAt(line, layout.size))
    );
    expect(widest).toBeLessThanOrEqual(70);
    expect(layout.lines.join("")).toBe("seal-e2e@seal.nyc");
  });

  it("treats a selected checkbox option as checked", () => {
    expect(isTruthyCheckbox('["Yes"]')).toBe(true);
    expect(isTruthyCheckbox("[]")).toBe(false);
    expect(isTruthyCheckbox("yes")).toBe(true);
    expect(isTruthyCheckbox(null)).toBe(false);
  });

  it("formats a stored timestamp as a calendar day", () => {
    expect(fieldBurnText("date", "2026-10-06T04:00:00.000Z")).toBe(
      "Oct 6, 2026"
    );
    expect(fieldBurnText("date_signed", "2026-10-06")).toBe("Oct 6, 2026");
    expect(fieldBurnText("text", "Alice")).toBe("Alice");
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
