/**
 * Offline checks for platform PAdES-B markers on a completed signed PDF.
 * Mirrors apps/api/scripts/prove-pdf-seal.ts (openssl cms over ByteRange).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ESS_SIGNING_CERT_V2_OID = Buffer.from([
  0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x2f,
]);

export function pdfHasEtsiCadesDetached(bytes) {
  return Buffer.from(bytes).toString("latin1").includes("/SubFilter /ETSI.CAdES.detached");
}

export function pdfHasByteRange(bytes) {
  return /\/ByteRange\s*\[/.test(Buffer.from(bytes).toString("latin1"));
}

function sliceDer(padded) {
  if (padded.byteLength < 2) {
    throw new Error("DER too short");
  }
  if (padded[0] !== 0x30) {
    throw new Error(`Expected DER SEQUENCE, got 0x${padded[0]?.toString(16)}`);
  }
  const lenByte = padded[1];
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
      length = (length << 8) | padded[offset + i];
    }
    offset += n;
  }
  const end = offset + length;
  if (end > padded.byteLength) {
    throw new Error("DER length exceeds buffer");
  }
  return padded.subarray(0, end);
}

export function extractCmsDerFromSignedPdf(bytes) {
  const text = Buffer.from(bytes).toString("latin1");
  const contentsMatch = text.match(/\/Contents\s*<([0-9A-Fa-f\s]+)>/);
  if (!contentsMatch?.[1]) {
    throw new Error("PDF missing /Contents hex");
  }
  const padded = Buffer.from(contentsMatch[1].replace(/\s+/g, ""), "hex");
  return sliceDer(padded);
}

/**
 * @param {Uint8Array | Buffer} bytes
 * @returns {{ ok: boolean; partial: boolean; detail: string }}
 */
export function verifySealedPdfBytes(bytes) {
  const buf = Buffer.from(bytes);
  if (
    buf.length < 4 ||
    buf[0] !== 0x25 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x44 ||
    buf[3] !== 0x46
  ) {
    return { ok: false, partial: false, detail: "not a PDF" };
  }

  const etsi = pdfHasEtsiCadesDetached(bytes);
  const byteRange = pdfHasByteRange(bytes);
  if (!etsi && !byteRange) {
    return {
      ok: false,
      partial: false,
      detail: "no ETSI.CAdES.detached or ByteRange (flatten-only artifact?)",
    };
  }
  if (!etsi || !byteRange) {
    return {
      ok: false,
      partial: true,
      detail: `partial markers etsi=${etsi} byteRange=${byteRange}`,
    };
  }

  const text = buf.toString("latin1");
  const rangeMatch = text.match(
    /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/
  );
  if (!rangeMatch) {
    return { ok: false, partial: true, detail: "ByteRange present but unparsable" };
  }
  const a = Number(rangeMatch[1]);
  const b = Number(rangeMatch[2]);
  const c = Number(rangeMatch[3]);
  const d = Number(rangeMatch[4]);

  let cmsDer;
  try {
    cmsDer = extractCmsDerFromSignedPdf(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, partial: true, detail: `CMS extract failed: ${msg}` };
  }

  if (!cmsDer.includes(ESS_SIGNING_CERT_V2_OID)) {
    return {
      ok: false,
      partial: true,
      detail: "missing ESS signing-certificate-v2 OID in CMS",
    };
  }

  const covered = Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]);
  const dir = mkdtempSync(join(tmpdir(), "seal-pades-verify-"));
  try {
    const cmsPath = join(dir, "cms.der");
    const contentPath = join(dir, "byterange.bin");
    writeFileSync(cmsPath, cmsDer);
    writeFileSync(contentPath, covered);

    const verify = spawnSync(
      "openssl",
      [
        "cms",
        "-verify",
        "-inform",
        "DER",
        "-in",
        cmsPath,
        "-content",
        contentPath,
        "-noverify",
        "-binary",
      ],
      { encoding: "utf8" }
    );
    if (verify.status !== 0) {
      const errText = (verify.stderr || verify.stdout || "").slice(0, 300);
      return {
        ok: false,
        partial: true,
        detail: `openssl cms verify failed: ${errText}`,
      };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  return {
    ok: true,
    partial: false,
    detail: `etsi+byteRange+ESS+openssl (${buf.length} bytes)`,
  };
}
