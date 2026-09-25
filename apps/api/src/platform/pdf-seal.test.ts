import { PDFDocument, rgb } from "pdf-lib";
import forge from "node-forge";
import { describe, expect, it } from "vitest";

import { flattenFieldsIntoPdf, sha256PdfBytes } from "./final-pdf.js";
import {
  pdfHasByteRange,
  pdfHasEtsiCadesDetached,
  readPdfSealCredentials,
  sealPdfBytes,
  extractCmsDerFromSignedPdf,
} from "./pdf-seal.js";

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText("Contract", { x: 50, y: 740, size: 14, color: rgb(0, 0, 0) });
  return doc.save();
}

function makeTestP12(passphrase: string): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + 5
  );
  const attrs = [
    { name: "commonName", value: "Seal Platform Seal" },
    { name: "organizationName", value: "Seal" },
    { name: "countryName", value: "US" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: "3des",
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return forge.util.encode64(der);
}

describe("pdf-seal (SEA-49 L1b)", () => {
  it("skips credentials when secrets are absent", () => {
    expect(readPdfSealCredentials({})).toBeNull();
  });

  it("fails closed when only one sealing secret is set", () => {
    expect(() =>
      readPdfSealCredentials({ SEAL_SEALING_P12: "YWJj" })
    ).toThrow(/both be set/);
    expect(() =>
      readPdfSealCredentials({ SEAL_SEALING_P12_PASSPHRASE: "x" })
    ).toThrow(/both be set/);
  });

  it("reads credentials when both secrets are set", () => {
    const creds = readPdfSealCredentials({
      SEAL_SEALING_P12: " YWJj \n",
      SEAL_SEALING_P12_PASSPHRASE: "",
    });
    expect(creds).toEqual({ p12Base64: "YWJj", passphrase: "" });
  });

  it("seals flattened bytes with ETSI.CAdES.detached + ESS attr", async () => {
    const passphrase = "test-passphrase";
    const p12Base64 = makeTestP12(passphrase);
    const src = await makePdf();
    const flattened = await flattenFieldsIntoPdf(src, [
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
    ]);

    const sealed = await sealPdfBytes(flattened.bytes, {
      p12Base64,
      passphrase,
    });

    expect(sealed.sealed).toBe(true);
    expect(pdfHasEtsiCadesDetached(sealed.bytes)).toBe(true);
    expect(pdfHasByteRange(sealed.bytes)).toBe(true);
    expect(await sha256PdfBytes(sealed.bytes)).not.toBe(
      flattened.documentHash
    );
    // ESS signing-certificate-v2 OID 1.2.840.113549.1.9.16.2.47
    const cms = extractCmsDerFromSignedPdf(sealed.bytes);
    const essOid = Buffer.from([
      0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x2f,
    ]);
    expect(cms.includes(essOid)).toBe(true);
    expect((await PDFDocument.load(sealed.bytes)).getPageCount()).toBe(1);
  }, 60_000);

  it("rejects empty p12 payload", async () => {
    const src = await makePdf();
    await expect(
      sealPdfBytes(src, { p12Base64: "", passphrase: "x" })
    ).rejects.toThrow(/empty/);
  });
});
