import { describe, expect, test } from "vitest";

import {
  MAX_FILE_SIZE,
  getAllowedExtensions,
  getAllowedMimeTypes,
  formatFileSize,
  getMaxFileSizeDisplay,
  getSupportedFileTypesDisplay,
  validateFileSize,
  validateFileType,
  validateFileExtension,
  validateFile,
} from "../upload_config";

describe("upload_config", () => {
  describe("constants", () => {
    test("MAX_FILE_SIZE equals 100MB in bytes", () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    });
  });

  describe("getAllowedExtensions", () => {
    test('returns [".pdf"]', () => {
      expect(getAllowedExtensions()).toEqual([".pdf"]);
    });
  });

  describe("getAllowedMimeTypes", () => {
    test('returns ["application/pdf"]', () => {
      expect(getAllowedMimeTypes()).toEqual(["application/pdf"]);
    });
  });

  describe("formatFileSize", () => {
    test('0 bytes → "0 Bytes"', () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
    });

    test('1024 bytes → "1 KB"', () => {
      expect(formatFileSize(1024)).toBe("1 KB");
    });

    test('1048576 bytes → "1 MB"', () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
    });
  });

  describe("getMaxFileSizeDisplay", () => {
    test('returns "100 MB"', () => {
      expect(getMaxFileSizeDisplay()).toBe("100 MB");
    });
  });

  describe("getSupportedFileTypesDisplay", () => {
    test('returns "PDF only"', () => {
      expect(getSupportedFileTypesDisplay()).toBe("PDF only");
    });
  });

  describe("validateFileSize", () => {
    test("accepts a normal file size", () => {
      expect(validateFileSize(1024)).toEqual({ valid: true });
    });

    test("accepts exactly MAX_FILE_SIZE", () => {
      expect(validateFileSize(MAX_FILE_SIZE)).toEqual({ valid: true });
    });

    test("rejects file larger than MAX_FILE_SIZE", () => {
      const result = validateFileSize(MAX_FILE_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File size must be under 100MB");
    });

    test("rejects empty file (0 bytes)", () => {
      const result = validateFileSize(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File is empty");
    });
  });

  describe("validateFileType", () => {
    test("accepts application/pdf", () => {
      expect(validateFileType("application/pdf")).toEqual({ valid: true });
    });

    test("rejects image/png", () => {
      const result = validateFileType("image/png");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Only PDF files are supported");
    });

    test("rejects empty string", () => {
      const result = validateFileType("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File type could not be determined");
    });
  });

  describe("validateFileExtension", () => {
    test("accepts doc.pdf with application/pdf", () => {
      expect(validateFileExtension("doc.pdf", "application/pdf")).toEqual({
        valid: true,
      });
    });

    test("rejects doc.txt with application/pdf (extension mismatch)", () => {
      const result = validateFileExtension("doc.txt", "application/pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "File extension '.txt' does not match file type 'application/pdf'"
      );
    });
  });

  describe("validateFile", () => {
    test("valid PDF passes all checks", () => {
      const result = validateFile("document.pdf", "application/pdf", 1024);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("collects multiple errors for invalid file", () => {
      const result = validateFile(
        "document.txt",
        "image/png",
        MAX_FILE_SIZE + 1
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("File size must be under 100MB");
      expect(result.errors).toContain("Only PDF files are supported");
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
