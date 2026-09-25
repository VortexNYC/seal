import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildCertificateOfCompletionPdf,
  certificateStorageKey,
  sanitizePdfText,
} from "./certificate-of-completion.js";

describe("certificate-of-completion", () => {
  it("builds a stable R2 key", () => {
    expect(certificateStorageKey("org_1", "doc_2")).toBe(
      "certificates/org_1/doc_2.pdf"
    );
  });

  it("sanitizes non-WinAnsi glyphs", () => {
    expect(sanitizePdfText("NDA — Acme ↔ Vortex")).toBe("NDA ? Acme <-> Vortex");
  });

  it("produces a valid PDF with EVID-2 fields", async () => {
    const bytes = await buildCertificateOfCompletionPdf({
      documentName: "NDA — Acme ↔ Vortex",
      documentPublicId: "pub_abc",
      documentId: "doc_xyz",
      organizationName: "Vortex",
      completedAt: "2026-09-24T12:00:00.000Z",
      documentHash: "sha256:deadbeef",
      verificationUrl: "https://app.seal.nyc/verify/qr-token-1",
      parties: [
        {
          name: "Alice Signer",
          email: "alice@example.com",
          role: "signer",
          status: "signed",
          completedAt: "2026-09-24T11:59:00.000Z",
          ipAddress: "203.0.113.10",
          authMethod: "email_otp",
          consentAt: "2026-09-24T11:58:30.000Z",
          consentTextHash: "sha256:abc123",
          privacyNoticeAt: "2026-09-24T11:58:00.000Z",
          privacyNoticeTextHash: "sha256:privacyabc",
          esignOptOutAt: null,
          esignOptOutMethod: null,
        },
        {
          name: "Bob CC",
          email: "bob@example.com",
          role: "viewer",
          status: "viewed",
          completedAt: "2026-09-24T11:58:00.000Z",
          ipAddress: null,
          authMethod: "none",
          consentAt: null,
          consentTextHash: null,
          privacyNoticeAt: null,
          privacyNoticeTextHash: null,
          esignOptOutAt: null,
          esignOptOutMethod: null,
        },
      ],
      events: [
        {
          action: "document.sent",
          at: "2026-09-24T11:00:00.000Z",
          actor: "user:owner",
        },
        {
          action: "recipient.signed",
          at: "2026-09-24T11:59:00.000Z",
          actor: "recipient:alice",
          detail: "IP 203.0.113.10",
        },
      ],
    });

    expect(bytes.byteLength).toBeGreaterThan(500);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);

    const page = pdf.getPage(0);
    const { width, height } = page.getSize();
    expect(width).toBe(612);
    expect(height).toBe(792);
  });
});
