import { describe, expect, test } from "vitest";
import {
  generateStringHash,
  generateSignatureHash,
  verifySignatureHash,
  generateSignatureImageHash,
  verifyDocumentIntegrity,
  generateSignatureCertificate,
} from "../helpers";

describe("generateStringHash", () => {
  test("returns a 64-character hex string", async () => {
    const hash = await generateStringHash("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("is deterministic — same input produces same output", async () => {
    const hash1 = await generateStringHash("deterministic-test");
    const hash2 = await generateStringHash("deterministic-test");
    expect(hash1).toBe(hash2);
  });

  test("different inputs produce different outputs", async () => {
    const hash1 = await generateStringHash("input-a");
    const hash2 = await generateStringHash("input-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("generateSignatureHash", () => {
  test("returns a valid 64-char hex hash", async () => {
    const hash = await generateSignatureHash(
      "John Doe",
      "recipient-123",
      "field-456",
      "doc-hash-abc",
      1700000000000,
    );
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifySignatureHash", () => {
  const signatureData = "Jane Smith";
  const recipientId = "recipient-789";
  const fieldId = "field-012";
  const documentHash = "doc-hash-xyz";
  const timestamp = 1700000000000;

  test("returns true when hash matches the original data", async () => {
    const hash = await generateSignatureHash(
      signatureData,
      recipientId,
      fieldId,
      documentHash,
      timestamp,
    );
    const result = await verifySignatureHash(
      signatureData,
      recipientId,
      fieldId,
      documentHash,
      timestamp,
      hash,
    );
    expect(result).toBe(true);
  });

  test("returns false when data has been tampered with", async () => {
    const hash = await generateSignatureHash(
      signatureData,
      recipientId,
      fieldId,
      documentHash,
      timestamp,
    );
    const result = await verifySignatureHash(
      "Tampered Name",
      recipientId,
      fieldId,
      documentHash,
      timestamp,
      hash,
    );
    expect(result).toBe(false);
  });
});

describe("generateSignatureImageHash", () => {
  test("strips data URL prefix before hashing", async () => {
    const rawBase64 = "iVBORw0KGgoAAAANSUhEUg==";
    const dataUrl = `data:image/png;base64,${rawBase64}`;

    const hashFromDataUrl = await generateSignatureImageHash(dataUrl);
    const hashFromRaw = await generateSignatureImageHash(rawBase64);

    expect(hashFromDataUrl).toBe(hashFromRaw);
  });

  test("returns same hash for raw base64 and full data URL with same base64", async () => {
    const base64Content = "SGVsbG8gV29ybGQ=";
    const fullDataUrl = `data:image/png;base64,${base64Content}`;

    const hash1 = await generateSignatureImageHash(base64Content);
    const hash2 = await generateSignatureImageHash(fullDataUrl);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  test("returns undefined for undefined input", async () => {
    const result = await generateSignatureImageHash(undefined);
    expect(result).toBeUndefined();
  });
});

describe("verifyDocumentIntegrity", () => {
  test("returns true for matching hashes", () => {
    expect(verifyDocumentIntegrity("abc123", "abc123")).toBe(true);
  });

  test("returns false for different hashes", () => {
    expect(verifyDocumentIntegrity("abc123", "xyz789")).toBe(false);
  });
});

describe("generateSignatureCertificate", () => {
  const baseSignature = {
    signatureHash: "sig-hash-abc",
    documentHashAtSigning: "doc-hash-at-sign",
    signedAt: 1700000000000,
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0 Test",
    signatureMethod: "draw",
  };

  const baseRecipient = {
    name: "John Doe",
    email: "john@example.com",
  };

  const baseDocument = {
    name: "Contract.pdf",
    documentHash: "doc-hash-at-sign",
  };

  test("builds correct certificate object with all fields", () => {
    const cert = generateSignatureCertificate(baseSignature, baseRecipient, baseDocument);

    expect(cert).toEqual({
      certificateVersion: "1.0",
      documentName: "Contract.pdf",
      documentHash: "doc-hash-at-sign",
      signerName: "John Doe",
      signerEmail: "john@example.com",
      signedAt: new Date(1700000000000).toISOString(),
      signatureHash: "sig-hash-abc",
      documentHashAtSigning: "doc-hash-at-sign",
      signatureMethod: "draw",
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 Test",
      integrityVerified: true,
    });
  });

  test("integrityVerified is true when document hash matches signature hash at signing", () => {
    const cert = generateSignatureCertificate(baseSignature, baseRecipient, baseDocument);
    expect(cert.integrityVerified).toBe(true);
  });

  test("integrityVerified is false when hashes differ", () => {
    const cert = generateSignatureCertificate(baseSignature, baseRecipient, {
      ...baseDocument,
      documentHash: "different-hash",
    });
    expect(cert.integrityVerified).toBe(false);
  });

  test("handles null/undefined optional fields gracefully", () => {
    const cert = generateSignatureCertificate(
      {
        signatureHash: null,
        documentHashAtSigning: undefined,
        signedAt: 1700000000000,
        ipAddress: "0.0.0.0",
        userAgent: "TestAgent",
        signatureMethod: undefined,
      },
      {
        name: undefined,
        email: "anon@example.com",
      },
      {
        name: "Unsigned.pdf",
        documentHash: undefined,
      },
    );

    expect(cert.signatureHash).toBeNull();
    expect(cert.documentHashAtSigning).toBeNull();
    expect(cert.signatureMethod).toBeNull();
    expect(cert.signerName).toBeNull();
    expect(cert.documentHash).toBeNull();
    // When both hashes are undefined, undefined !== null is true for both checks,
    // and undefined === undefined, so integrityVerified is true
    expect(cert.integrityVerified).toBe(true);
  });

  test("integrityVerified is false when one hash is null and other is undefined", () => {
    const cert = generateSignatureCertificate(
      {
        signatureHash: null,
        documentHashAtSigning: null,
        signedAt: 1700000000000,
        ipAddress: "0.0.0.0",
        userAgent: "TestAgent",
        signatureMethod: undefined,
      },
      {
        name: undefined,
        email: "anon@example.com",
      },
      {
        name: "Unsigned.pdf",
        documentHash: undefined,
      },
    );

    // documentHash is undefined (coerced to null via ??), documentHashAtSigning is null
    // The check: null !== null is false, so integrityVerified is false
    expect(cert.integrityVerified).toBe(false);
  });
});
