#!/usr/bin/env tsx
/**
 * Prove SEA-49 Level 1b platform PAdES-B seal.
 *
 * Uses the same `sealPdfBytes` path as production, then asserts:
 *   - /SubFilter /ETSI.CAdES.detached
 *   - /ByteRange present
 *   - ESS signing-certificate-v2 OID present in CMS
 *   - openssl cms -verify -noverify succeeds over the ByteRange segments
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PDFDocument, rgb } from "pdf-lib";
import forge from "node-forge";

import {
  extractCmsDerFromSignedPdf,
  pdfHasByteRange,
  pdfHasEtsiCadesDetached,
  sealPdfBytes,
} from "../src/platform/pdf-seal.ts";

function pass(msg: string): void {
  console.log(`PASS  ${msg}`);
}
function fail(msg: string): void {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function makeTestP12(passphrase: string): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
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
  return forge.util.encode64(forge.asn1.toDer(p12Asn1).getBytes());
}

async function main(): Promise<void> {
  const passphrase = "prove-passphrase";
  const p12Base64 = makeTestP12(passphrase);

  const doc = await PDFDocument.create();
  doc.addPage([612, 792]).drawText("SEA-49 prove", {
    x: 50,
    y: 740,
    size: 14,
    color: rgb(0, 0, 0),
  });
  const flat = await doc.save({ useObjectStreams: false });

  const sealed = await sealPdfBytes(flat, { p12Base64, passphrase });
  const signed = Buffer.from(sealed.bytes);

  if (pdfHasEtsiCadesDetached(sealed.bytes)) {
    pass("SubFilter ETSI.CAdES.detached present");
  } else {
    fail("missing /SubFilter /ETSI.CAdES.detached");
  }

  if (pdfHasByteRange(sealed.bytes)) {
    pass("ByteRange present");
  } else {
    fail("missing /ByteRange");
  }

  const text = signed.toString("latin1");
  const rangeMatch = text.match(
    /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/
  );
  if (!rangeMatch) {
    fail("could not parse ByteRange values");
    return;
  }
  const a = Number(rangeMatch[1]);
  const b = Number(rangeMatch[2]);
  const c = Number(rangeMatch[3]);
  const d = Number(rangeMatch[4]);
  pass(`ByteRange ${a} ${b} ${c} ${d}`);

  const cmsDer = extractCmsDerFromSignedPdf(sealed.bytes);
  const essOid = Buffer.from([
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x2f,
  ]);
  if (cmsDer.includes(essOid)) {
    pass("ESS signing-certificate-v2 OID present");
  } else {
    fail("missing ESS signing-certificate-v2 authenticated attribute");
  }

  const covered = Buffer.concat([
    signed.subarray(a, a + b),
    signed.subarray(c, c + d),
  ]);

  const dir = mkdtempSync(path.join(tmpdir(), "seal-pdf-seal-"));
  const cmsPath = path.join(dir, "cms.der");
  const contentPath = path.join(dir, "byterange.bin");
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
  if (verify.status === 0) {
    pass("openssl cms -verify -noverify (ByteRange digest)");
  } else {
    fail(
      `openssl cms verify failed: ${(verify.stderr || verify.stdout || "").slice(0, 400)}`
    );
  }

  const hash = createHash("sha256").update(signed).digest("hex");
  pass(`sealed sha256 ${hash.slice(0, 16)}… (${signed.length} bytes)`);

  rmSync(dir, { recursive: true, force: true });

  if (process.exitCode) {
    console.error("prove:pdf-seal failed");
    process.exit(1);
  }
  console.log("prove:pdf-seal ok");
}

const here = path.dirname(fileURLToPath(import.meta.url));
void here;

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
