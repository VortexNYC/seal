import { describe, expect, test } from "vitest";

import {
  MAX_FILE_SIZE,
  getAllowedExtensions,
  getAllowedMimeTypes,
  formatFileSize,
  getMaxFileSizeDisplay,
  getSupportedFileTypesDisplay,
  sanitizeFileName,
  validateFileName,
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

  describe("sanitizeFileName", () => {
    test("passes through a normal filename", () => {
      expect(sanitizeFileName("contract.pdf")).toBe("contract.pdf");
    });

    test("strips directory traversal sequences (../)", () => {
      expect(sanitizeFileName("../../../etc/passwd")).toBe("passwd.pdf");
    });

    test("strips backslash directory traversal", () => {
      expect(sanitizeFileName("..\\..\\Windows\\System32\\config.pdf")).toBe("config.pdf");
    });

    test("strips forward slash paths", () => {
      expect(sanitizeFileName("/etc/shadow")).toBe("shadow.pdf");
    });

    test("strips mixed path separators", () => {
      expect(sanitizeFileName("foo/bar\\baz/document.pdf")).toBe("document.pdf");
    });

    test("removes null bytes", () => {
      expect(sanitizeFileName("document.pdf\0.exe")).toBe("document.pdf.exe");
    });

    test("removes control characters", () => {
      expect(sanitizeFileName("doc\x01\x02ument.pdf")).toBe("document.pdf");
    });

    test("collapses multiple spaces", () => {
      expect(sanitizeFileName("my   document.pdf")).toBe("my document.pdf");
    });

    test("trims whitespace", () => {
      expect(sanitizeFileName("  document.pdf  ")).toBe("document.pdf");
    });

    test("strips leading dots (hidden files)", () => {
      expect(sanitizeFileName("..contract.pdf")).toBe("contract.pdf");
    });

    test("falls back to document.pdf for empty input", () => {
      expect(sanitizeFileName("")).toBe("document.pdf");
    });

    test("falls back to document.pdf for only dots/slashes", () => {
      expect(sanitizeFileName("../..")).toBe("document.pdf");
    });

    test("adds .pdf extension if no extension present after sanitization", () => {
      expect(sanitizeFileName("document")).toBe("document.pdf");
    });

    test("preserves non-.pdf extensions (validation handles rejection)", () => {
      expect(sanitizeFileName("document.txt")).toBe("document.txt");
    });
  });

  describe("validateFileName", () => {
    test("accepts a normal filename", () => {
      expect(validateFileName("document.pdf")).toEqual({ valid: true });
    });

    test("rejects empty filename", () => {
      const result = validateFileName("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name is required");
    });

    test("rejects filename with null bytes", () => {
      const result = validateFileName("doc\0.pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name contains invalid characters");
    });

    test("rejects filename with forward slash", () => {
      const result = validateFileName("path/to/file.pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name must not contain path separators");
    });

    test("rejects filename with backslash", () => {
      const result = validateFileName("path\\to\\file.pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name must not contain path separators");
    });

    test("rejects filename with .. traversal", () => {
      const result = validateFileName("..document.pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name must not contain path traversal sequences");
    });

    test("rejects filename with control characters", () => {
      const result = validateFileName("doc\x01.pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name contains invalid characters");
    });

    test("rejects filename over 255 characters", () => {
      const longName = "a".repeat(256);
      const result = validateFileName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File name must be 255 characters or less");
    });

    test("accepts filename at exactly 255 characters", () => {
      const name = "a".repeat(251) + ".pdf";
      expect(validateFileName(name)).toEqual({ valid: true });
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
      expect(result.error).toBe("File extension '.txt' does not match file type 'application/pdf'");
    });
  });

  describe("validateFile", () => {
    test("valid PDF passes all checks", () => {
      const result = validateFile("document.pdf", "application/pdf", 1024);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("collects multiple errors for invalid file", () => {
      const result = validateFile("document.txt", "image/png", MAX_FILE_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("File size must be under 100MB");
      expect(result.errors).toContain("Only PDF files are supported");
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    test("rejects filename with path traversal", () => {
      const result = validateFile("../../etc/passwd", "application/pdf", 1024);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("File name must not contain path separators");
    });
  });
});
