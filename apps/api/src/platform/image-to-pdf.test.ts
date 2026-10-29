import { describe, expect, it } from "vitest";

import {
  imageBytesToPdf,
  isImageFileType,
  ConversionError,
} from "./document-conversion.js";

// 1×1 transparent PNG (68 bytes) and a minimal 1×1 JPEG.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const JPEG_1X1 = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAT8A/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQL/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AT//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AT//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxA//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxA//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA//9k=",
  "base64"
);

describe("imageBytesToPdf", () => {
  it("accepts png and jpeg as image types", () => {
    expect(isImageFileType("image/png")).toBe(true);
    expect(isImageFileType("image/jpeg")).toBe(true);
    expect(isImageFileType("application/pdf")).toBe(false);
  });

  it("packs a PNG into a one-page PDF sized to the image", async () => {
    const pdf = await imageBytesToPdf({
      contentType: "image/png",
      bytes: PNG_1X1,
      name: "pixel",
    });
    expect(pdf.byteLength).toBeGreaterThan(100);
    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.load(pdf);
    expect(out.getPageCount()).toBe(1);
    const page = out.getPage(0);
    expect(page.getWidth()).toBe(1);
    expect(page.getHeight()).toBe(1);
  });

  it("packs a JPEG into a one-page PDF", async () => {
    const pdf = await imageBytesToPdf({
      contentType: "image/jpeg",
      bytes: JPEG_1X1,
      name: "pixel",
    });
    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.load(pdf);
    expect(out.getPageCount()).toBe(1);
  });

  it("rejects an unsupported content type", async () => {
    await expect(
      imageBytesToPdf({
        contentType: "image/gif",
        bytes: new Uint8Array([1, 2, 3]),
        name: "x",
      })
    ).rejects.toThrow(ConversionError);
  });

  it("rejects corrupt image bytes", async () => {
    await expect(
      imageBytesToPdf({
        contentType: "image/png",
        bytes: new Uint8Array([0, 1, 2, 3]),
        name: "x",
      })
    ).rejects.toThrow();
  });
});
