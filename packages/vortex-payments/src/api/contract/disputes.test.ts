import { describe, expect, test } from "vitest";
import { validateDisputeEvidenceUploadBatch, type UploadDisputeEvidenceRequest } from "./disputes";

describe("dispute evidence upload preflight", () => {
  test("accepts Finix-supported evidence files", () => {
    expect(validateDisputeEvidenceUploadBatch([
      { fileName: "receipt.jpg", contentType: "image/jpeg", sizeBytes: 900_000 },
      { fileName: "terms.pdf", contentType: "application/pdf", sizeBytes: 900_000 },
    ])).toEqual({ ok: true, errors: [] });
  });

  test("rejects Finix evidence limit violations", () => {
    const invalidType = "text/plain" as UploadDisputeEvidenceRequest["contentType"];
    const result = validateDisputeEvidenceUploadBatch([
      { fileName: "bad.txt", contentType: invalidType, sizeBytes: 1 },
      { fileName: "too-large.jpg", contentType: "image/jpeg", sizeBytes: 1_000_001 },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("bad.txt contentType must be PDF, JPEG, or PNG");
    expect(result.errors).toContain("too-large.jpg sizeBytes must be <= 1000000");
  });
});
