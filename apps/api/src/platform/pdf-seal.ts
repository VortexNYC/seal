/**
 * Platform PAdES-B seal over flattened final PDF bytes (SEA-49 Level 1b).
 * Embeds CMS with SubFilter ETSI.CAdES.detached using a Worker-held PKCS#12.
 *
 * Uses @signpdf/placeholder-plain (not placeholder-pdf-lib) so we never
 * CJS-require pdf-lib — that breaks the Workers vitest pool.
 */

import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import signpdfImport from "@signpdf/signpdf";
import { SUBFILTER_ETSI_CADES_DETACHED } from "@signpdf/utils";
import { PDFDocument } from "pdf-lib";

import { PadesP12Signer } from "./pades-p12-signer.js";

const signpdf =
  "sign" in signpdfImport && typeof signpdfImport.sign === "function"
    ? signpdfImport
    : (signpdfImport as unknown as { default: typeof signpdfImport }).default;

/** Reserved CMS byte budget inside /Contents (signpdf pads unused space). */
export const PDF_SEAL_SIGNATURE_LENGTH = 32_768;

export type PdfSealCredentials = {
  /** Base64-encoded PKCS#12 (.p12 / .pfx). */
  p12Base64: string;
  passphrase: string;
};

export type SealPdfResult = {
  bytes: Uint8Array;
  sealed: true;
};

export type PdfSealEnv = {
  SEAL_SEALING_P12?: string;
  SEAL_SEALING_P12_PASSPHRASE?: string;
};

/**
 * Read platform sealing secrets.
 * Both must be set together. One-without-the-other throws (fail closed).
 * Neither set → null (self-host / local flatten-only).
 */
export function readPdfSealCredentials(
  env: PdfSealEnv
): PdfSealCredentials | null {
  const rawP12 = env.SEAL_SEALING_P12;
  const hasP12 = rawP12 !== undefined && rawP12.trim() !== "";
  const hasPass = env.SEAL_SEALING_P12_PASSPHRASE !== undefined;

  if (!hasP12 && !hasPass) {
    return null;
  }
  if (!hasP12 || !hasPass) {
    throw new Error(
      "SEAL_SEALING_P12 and SEAL_SEALING_P12_PASSPHRASE must both be set (or neither)"
    );
  }

  return {
    p12Base64: (rawP12 as string).trim(),
    passphrase: env.SEAL_SEALING_P12_PASSPHRASE as string,
  };
}

function decodeP12Base64(p12Base64: string): Buffer {
  const cleaned = p12Base64.replace(/\s+/g, "");
  const buf = Buffer.from(cleaned, "base64");
  if (buf.byteLength === 0) {
    throw new Error("SEAL_SEALING_P12 decoded to empty bytes");
  }
  return buf;
}

/**
 * Embed a platform PAdES-B signature over PDF bytes (already flattened).
 * Requires a PKCS#12; throws if signing fails (callers decide fail policy).
 */
export async function sealPdfBytes(
  pdfBytes: Uint8Array,
  credentials: PdfSealCredentials
): Promise<SealPdfResult> {
  const p12 = decodeP12Base64(credentials.p12Base64);

  // placeholder-plain only understands classic xref tables — pdf-lib may emit
  // cross-reference streams unless useObjectStreams is forced off.
  const loaded = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const classicBytes = Buffer.from(
    await loaded.save({ useObjectStreams: false })
  );

  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer: classicBytes,
    reason: "Document sealed by Seal",
    contactInfo: "platform@seal.nyc",
    name: "Seal Platform",
    location: "United States",
    signatureLength: PDF_SEAL_SIGNATURE_LENGTH,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });

  const signer = new PadesP12Signer(p12, {
    passphrase: credentials.passphrase,
  });
  const signed = await signpdf.sign(withPlaceholder, signer);

  return {
    bytes: new Uint8Array(signed.buffer, signed.byteOffset, signed.byteLength),
    sealed: true,
  };
}

/** True when the PDF dictionary advertises an ETSI CAdES detached SubFilter. */
export function pdfHasEtsiCadesDetached(bytes: Uint8Array): boolean {
  const text = Buffer.from(bytes).toString("latin1");
  return text.includes("/SubFilter /ETSI.CAdES.detached");
}

/** True when a /ByteRange array is present (signature dictionary wired). */
export function pdfHasByteRange(bytes: Uint8Array): boolean {
  const text = Buffer.from(bytes).toString("latin1");
  return /\/ByteRange\s*\[/.test(text);
}

/**
 * Extract the CMS/PKCS#7 DER from a signed PDF /Contents hex string,
 * using the DER length prefix (not trailing-NUL stripping).
 */
export function extractCmsDerFromSignedPdf(bytes: Uint8Array): Buffer {
  const text = Buffer.from(bytes).toString("latin1");
  const contentsMatch = text.match(/\/Contents\s*<([0-9A-Fa-f\s]+)>/);
  if (!contentsMatch?.[1]) {
    throw new Error("PDF missing /Contents hex");
  }
  const padded = Buffer.from(contentsMatch[1].replace(/\s+/g, ""), "hex");
  return sliceDer(padded);
}

/** Slice a single top-level DER SEQUENCE out of a zero-padded buffer. */
export function sliceDer(padded: Buffer): Buffer {
  if (padded.byteLength < 2) {
    throw new Error("DER too short");
  }
  if (padded[0] !== 0x30) {
    throw new Error(`Expected DER SEQUENCE, got 0x${padded[0]?.toString(16)}`);
  }
  const lenByte = padded[1];
  if (lenByte === undefined) {
    throw new Error("DER missing length");
  }
  let offset = 2;
  let length = 0;
  if ((lenByte & 0x80) === 0) {
    length = lenByte;
  } else {
    const n = lenByte & 0x7f;
    if (n === 0 || n > 4 || padded.byteLength < 2 + n) {
      throw new Error("Invalid DER long-form length");
    }
    for (let i = 0; i < n; i++) {
      const b = padded[offset + i];
      if (b === undefined) {
        throw new Error("Invalid DER long-form length");
      }
      length = (length << 8) | b;
    }
    offset += n;
  }
  const end = offset + length;
  if (end > padded.byteLength) {
    throw new Error("DER length exceeds buffer");
  }
  return padded.subarray(0, end);
}
