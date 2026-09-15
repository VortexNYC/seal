/**
 * Frontend file upload validation
 * Mirrors backend validation in apps/api/src/api/documents.ts
 */

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Allowed MIME types
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".pptx", ".csv"]);

/**
 * MIME type to file extensions mapping for react-dropzone
 */
export const DROPZONE_ACCEPT_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "text/csv": [".csv"],
};

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get maximum file size display
 */
export function getMaxFileSizeDisplay(): string {
  return formatFileSize(MAX_FILE_SIZE);
}

/**
 * Get supported file types for display
 */
export function getSupportedFileTypesDisplay(): string {
  return "PDF, DOCX, XLSX, PPTX, CSV";
}

/**
 * Validate file before upload
 */
export function validateFileForUpload(file: File): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate size
  if (file.size === 0) {
    errors.push("File is empty");
  } else if (file.size > MAX_FILE_SIZE) {
    errors.push(
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${getMaxFileSizeDisplay()}`
    );
  }

  // Validate MIME type
  if (!file.type) {
    errors.push("File type could not be determined");
  } else if (!ALLOWED_MIME_TYPES.has(file.type)) {
    errors.push("Only PDF, DOCX, XLSX, PPTX, and CSV files are supported");
  }

  // Validate extension
  const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!fileExt) {
    errors.push("File must have an extension");
  } else if (!ALLOWED_EXTENSIONS.has(fileExt)) {
    errors.push("Only PDF, DOCX, XLSX, PPTX, and CSV files are supported");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
