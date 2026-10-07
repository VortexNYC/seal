/**
 * Final PDF for completed envelopes (SEA-49 Level 1a).
 * Burns field appearances into PDF bytes. Cryptographic seal is Level 1b.
 */

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

import { hedvigLettersSansBase64 } from "./hedvig-letters-sans.js";
import { percentToPdfRect } from "./pdf-ops.js";
import { trimTransparentPng } from "./png-trim.js";

/** Product ink. Matches the Taupe foreground used in the app. */
const FIELD_INK = rgb(44 / 255, 39 / 255, 31 / 255);

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
  const digest = await crypto.subtle.digest(
    "SHA-256",
    // SubtleCrypto requires ArrayBuffer-backed BufferSource (TS 5.7+).
    new Uint8Array(bytes)
  );
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

const BURNED_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Date prefix of a stored value, as a short calendar label. */
export function formatBurnedDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  const month = BURNED_MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return value.trim();
  return `${month} ${day}, ${match[1]}`;
}

/** Text actually drawn for a filled field. Dates are calendar days, not timestamps. */
export function fieldBurnText(fieldType: string, value: string): string {
  const type = fieldType.toLowerCase();
  if (type === "date" || type === "date_signed") return formatBurnedDate(value);
  return value.trim();
}

type TextMeasurer = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

function wrapFieldLine(
  measure: TextMeasurer,
  text: string,
  size: number,
  maxWidth: number
): string[] {
  if (measure.widthOfTextAtSize(text, size) <= maxWidth) return [text];
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (line && measure.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

/**
 * Largest size that keeps the whole value inside the field box.
 * Long values shrink, then wrap, instead of drawing past the box.
 */
export function layoutFieldText(
  measure: TextMeasurer,
  text: string,
  maxWidth: number,
  maxHeight: number
): { size: number; lines: string[] } {
  const ceiling = Math.min(12, Math.max(6, maxHeight * 0.72));
  let size = ceiling;
  while (size >= 6) {
    const lines = wrapFieldLine(measure, text, size, maxWidth);
    if (lines.length * size * 1.2 <= maxHeight + 0.01) {
      return { size, lines };
    }
    size = Math.round((size - 0.5) * 10) / 10;
  }
  const lines = wrapFieldLine(measure, text, 6, maxWidth);
  const capacity = Math.max(1, Math.floor(maxHeight / (6 * 1.2)));
  return { size: 6, lines: lines.slice(0, capacity) };
}

/** Helvetica is WinAnsi — strip non-encodable glyphs. */
export function sanitizePdfText(value: string): string {
  return value
    .replace(/\u2194/g, "<->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

/** Keep glyphs the embedded face can draw. A missing one becomes "?". */
export function textForEmbeddedFont(font: PDFFont, value: string): string {
  let out = "";
  for (const char of value) {
    try {
      font.encodeText(char);
      out += char;
    } catch {
      out += "?";
    }
  }
  return out;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

function isAffirmative(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v === "true" || v === "1" || v === "yes" || v === "on" || v === "checked"
  );
}

/** A checkbox is checked when the stored value says so, including a JSON option list. */
export function isTruthyCheckbox(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.some(
          (item) => typeof item === "string" && item.trim().length > 0
        );
      }
    } catch {
      return false;
    }
  }
  return isAffirmative(trimmed);
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
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(decodeBase64(hedvigLettersSansBase64));
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
    const cover = () => {
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(1, 1, 1),
      });
    };

    if (
      (type === "signature" || type === "initials") &&
      field.signatureImageUrl
    ) {
      const parsed = parseDataUrl(field.signatureImageUrl);
      if (parsed) {
        // DocuSeal-class: crop transparent margins so bottom-align puts ink on the rule.
        const imageBytes =
          parsed.kind === "png"
            ? trimTransparentPng(parsed.bytes)
            : parsed.bytes;
        const image =
          parsed.kind === "png"
            ? await doc.embedPng(imageBytes)
            : await doc.embedJpg(imageBytes);
        cover();
        const scale = Math.min(
          rect.width / image.width,
          rect.height / image.height
        );
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        // Center horizontally; bottom-align so ink sits on the signature line.
        page.drawImage(image, {
          x: rect.x + Math.max(0, (rect.width - drawW) / 2),
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
      cover();
      const size = Math.min(rect.height * 0.85, rect.width * 0.85, 14);
      page.drawText("X", {
        x: rect.x + Math.max(0, (rect.width - size * 0.6) / 2),
        y: rect.y + Math.max(0, (rect.height - size) / 2),
        size,
        font,
        color: FIELD_INK,
      });
      burnedFields += 1;
      continue;
    }

    // text / number / date / dropdown / radio / typed signature fallback
    const text = fieldBurnText(type, field.value ?? "");
    if (!text) continue;
    cover();
    const maxWidth = Math.max(rect.width - 4, 4);
    const maxHeight = Math.max(rect.height - 2, 4);
    const layout = layoutFieldText(font, text, maxWidth, maxHeight);
    const lineHeight = layout.size * 1.2;
    const block = layout.lines.length * lineHeight;
    let baseline =
      rect.y +
      (rect.height - block) / 2 +
      (layout.lines.length - 1) * lineHeight;
    for (const line of layout.lines) {
      page.drawText(textForEmbeddedFont(font, line), {
        x: rect.x + 2,
        y: baseline,
        size: layout.size,
        font,
        color: FIELD_INK,
      });
      baseline -= lineHeight;
    }
    burnedFields += 1;
  }

  const bytes = await doc.save();
  const documentHash = await sha256PdfBytes(bytes);
  return { bytes, documentHash, burnedFields };
}
