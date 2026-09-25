/**
 * Final PDF for completed envelopes (SEA-49 Level 1a).
 * Burns field appearances into PDF bytes. Cryptographic seal is Level 1b.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { percentToPdfRect } from "./pdf-ops.js";

export type FinalPdfField = {
  fieldType: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  signatureImageUrl: string | null;
};

export type FlattenFinalPdfResult = {
  bytes: Uint8Array;
  documentHash: string;
  burnedFields: number;
};

/** SHA-256 of raw PDF bytes as `sha256:<hex>`. */
export async function sha256PdfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function finalPdfStorageKey(
  organizationId: string,
  documentId: string
): string {
  return `signed/${organizationId}/${documentId}.pdf`;
}

/** Helvetica is WinAnsi — strip non-encodable glyphs. */
export function sanitizePdfText(value: string): string {
  return value
    .replace(/\u2194/g, "<->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function parseDataUrl(
  dataUrl: string
): { kind: "png" | "jpg"; bytes: Uint8Array } | null {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(
    dataUrl.trim()
  );
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const kind = match[1].toLowerCase() === "png" ? "png" : "jpg";
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { kind, bytes };
  } catch {
    return null;
  }
}

function isTruthyCheckbox(value: string | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on" || v === "checked";
}

/**
 * Burn filled field appearances into a copy of the source PDF.
 * Coordinates are percent-of-page (0–100), same as placement UI.
 */
export async function flattenFieldsIntoPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  fields: FinalPdfField[]
): Promise<FlattenFinalPdfResult> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  let burnedFields = 0;

  for (const field of fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();
    const rect = percentToPdfRect(
      pw,
      ph,
      field.x,
      field.y,
      field.width,
      field.height
    );

    const type = field.fieldType.toLowerCase();

    if (
      (type === "signature" || type === "initials") &&
      field.signatureImageUrl
    ) {
      const parsed = parseDataUrl(field.signatureImageUrl);
      if (parsed) {
        const image =
          parsed.kind === "png"
            ? await doc.embedPng(parsed.bytes)
            : await doc.embedJpg(parsed.bytes);
        const scale = Math.min(
          rect.width / image.width,
          rect.height / image.height
        );
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        page.drawImage(image, {
          x: rect.x,
          y: rect.y,
          width: drawW,
          height: drawH,
        });
        burnedFields += 1;
        continue;
      }
      // fall through to typed-name text if image URL is not embeddable
    }

    if (type === "checkbox") {
      if (!isTruthyCheckbox(field.value)) continue;
      const size = Math.min(rect.height * 0.85, rect.width * 0.85, 14);
      page.drawText("X", {
        x: rect.x + Math.max(0, (rect.width - size * 0.6) / 2),
        y: rect.y + Math.max(0, (rect.height - size) / 2),
        size,
        font,
        color: rgb(0.05, 0.05, 0.08),
      });
      burnedFields += 1;
      continue;
    }

    // text / number / date / dropdown / radio / typed signature fallback
    const text = field.value?.trim();
    if (!text) continue;
    const size = Math.min(Math.max(rect.height * 0.55, 8), 14);
    page.drawText(sanitizePdfText(text), {
      x: rect.x + 2,
      y: rect.y + Math.max(2, (rect.height - size) / 2),
      size,
      font,
      color: rgb(0.05, 0.05, 0.08),
      maxWidth: Math.max(rect.width - 4, 8),
    });
    burnedFields += 1;
  }

  const bytes = await doc.save();
  const documentHash = await sha256PdfBytes(bytes);
  return { bytes, documentHash, burnedFields };
}
