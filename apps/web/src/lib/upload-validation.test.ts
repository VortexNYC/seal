import { describe, test, expect } from "vitest";

import {
  MAX_FILE_SIZE,
  DROPZONE_ACCEPT_TYPES,
  formatFileSize,
  getMaxFileSizeDisplay,
  getSupportedFileTypesDisplay,
  validateFileForUpload,
} from "./upload-validation";

describe("upload-validation", () => {
  describe("MAX_FILE_SIZE", () => {
    test("equals 50MB in bytes", () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    });
  });

  describe("DROPZONE_ACCEPT_TYPES", () => {
    test("accepts application/pdf with .pdf extension", () => {
      expect(DROPZONE_ACCEPT_TYPES).toEqual({
        "application/pdf": [".pdf"],
      });
    });
  });

  describe("formatFileSize", () => {
    test("returns '0 Bytes' for 0", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
    });

    test("formats bytes", () => {
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    test("formats kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    test("formats megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    test("formats gigabytes", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
    });
  });

  describe("getMaxFileSizeDisplay", () => {
    test("returns formatted MAX_FILE_SIZE", () => {
      expect(getMaxFileSizeDisplay()).toBe("50 MB");
    });
  });

  describe("getSupportedFileTypesDisplay", () => {
    test("returns 'PDF only'", () => {
      expect(getSupportedFileTypesDisplay()).toBe("PDF only");
    });
  });

  describe("validateFileForUpload", () => {
    test("accepts a valid PDF file", () => {
      const file = new File(["pdf content"], "document.pdf", {
        type: "application/pdf",
      });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("rejects an empty file", () => {
      const file = new File([], "empty.pdf", { type: "application/pdf" });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("File is empty");
    });

    test("rejects an oversized file", () => {
      const oversizedContent = new Uint8Array(MAX_FILE_SIZE + 1);
      const file = new File([oversizedContent], "large.pdf", {
        type: "application/pdf",
      });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("exceeds maximum"))).toBe(
        true
      );
    });

    test("rejects a file with wrong MIME type", () => {
      const file = new File(["content"], "document.pdf", {
        type: "image/png",
      });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Only PDF files are supported");
    });

    test("rejects a file with no MIME type", () => {
      const file = new File(["content"], "document.pdf", { type: "" });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("File type could not be determined");
    });

    test("rejects a file with wrong extension", () => {
      const file = new File(["content"], "document.docx", {
        type: "application/pdf",
      });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Only PDF files are supported");
    });

    test("collects multiple errors for wrong MIME and extension", () => {
      const file = new File(["content"], "image.png", { type: "image/png" });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    test("handles uppercase .PDF extension as valid", () => {
      const file = new File(["content"], "DOCUMENT.PDF", {
        type: "application/pdf",
      });
      const result = validateFileForUpload(file);
      // The source lowercases the extension, so .PDF becomes .pdf
      expect(
        result.errors.some((e) => e.includes("Only PDF files are supported"))
      ).toBe(false);
    });
  });
});
