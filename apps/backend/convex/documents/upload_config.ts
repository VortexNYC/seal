/**
 * Document upload configuration and validation
 */

/**
 * Maximum file size in bytes (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Allowed MIME types organized by category
 * SEA-62: PDF only
 */
export const ALLOWED_MIME_TYPES = {
  // Documents - PDF only (SEA-62)
  "application/pdf": { ext: ".pdf", name: "PDF" },
} as const;

/**
 * Get list of allowed file extensions
 */
export function getAllowedExtensions(): string[] {
  return Object.values(ALLOWED_MIME_TYPES).map((info) => info.ext);
}

/**
 * Get list of allowed MIME types
 */
export function getAllowedMimeTypes(): string[] {
  return Object.keys(ALLOWED_MIME_TYPES);
}

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
 * Format maximum file size for display
 */
export function getMaxFileSizeDisplay(): string {
  return formatFileSize(MAX_FILE_SIZE);
}

/**
 * Get user-friendly list of supported file types
 * SEA-62: PDF only
 */
export function getSupportedFileTypesDisplay(): string {
  return "PDF only";
}

/**
 * Validate file size
 * SEA-62: Maximum 50MB enforced
 */
export function validateFileSize(fileSize: number): {
  valid: boolean;
  error?: string;
} {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File size must be under 100MB",
    };
  }

  if (fileSize === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  return { valid: true };
}

/**
 * Validate file type
 * SEA-62: PDF only
 */
export function validateFileType(fileType: string): {
  valid: boolean;
  error?: string;
} {
  if (!fileType) {
    return {
      valid: false,
      error: "File type could not be determined",
    };
  }

  const allowedTypes = getAllowedMimeTypes();
  if (!allowedTypes.includes(fileType)) {
    return {
      valid: false,
      error: "Only PDF files are supported",
    };
  }

  return { valid: true };
}

/**
 * Sanitize a file name to prevent path traversal and other injection attacks.
 *
 * - Strips directory components (path traversal: ../, /, \)
 * - Removes null bytes
 * - Removes control characters (U+0000–U+001F, U+007F)
 * - Collapses leading/trailing whitespace and dots
 * - Falls back to "document.pdf" if the result is empty
 */
export function sanitizeFileName(fileName: string): string {
  let sanitized = fileName;

  // 1. Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // 2. Remove control characters
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional sanitization of control chars
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  // 3. Normalize path separators and strip directory traversal
  //    Extract only the basename (last segment after / or \)
  sanitized = sanitized.split(/[/\\]/).pop() ?? "";

  // 4. Remove remaining .. sequences (e.g. "..contract.pdf" → "contract.pdf")
  sanitized = sanitized.replace(/^\.\.+/, "");

  // 5. Trim whitespace and leading/trailing dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, "");

  // 6. Collapse multiple spaces into one
  sanitized = sanitized.replace(/\s+/g, " ");

  // 7. Fallback if empty
  if (!sanitized) {
    return "document.pdf";
  }

  // 8. Re-add .pdf extension if it was stripped (e.g. filename was just ".pdf")
  if (!sanitized.includes(".")) {
    sanitized = `${sanitized}.pdf`;
  }

  return sanitized;
}

/**
 * Validate that a file name does not contain path traversal sequences.
 * Returns an error if the raw name contains suspicious patterns.
 */
export function validateFileName(fileName: string): {
  valid: boolean;
  error?: string;
} {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: "File name is required" };
  }

  // Reject null bytes
  if (fileName.includes("\0")) {
    return { valid: false, error: "File name contains invalid characters" };
  }

  // Reject path separators
  if (/[/\\]/.test(fileName)) {
    return { valid: false, error: "File name must not contain path separators" };
  }

  // Reject .. traversal
  if (/\.\./.test(fileName)) {
    return { valid: false, error: "File name must not contain path traversal sequences" };
  }

  // Reject control characters
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional validation of control chars
  if (/[\x00-\x1F\x7F]/.test(fileName)) {
    return { valid: false, error: "File name contains invalid characters" };
  }

  // Reasonable length limit
  if (fileName.length > 255) {
    return { valid: false, error: "File name must be 255 characters or less" };
  }

  return { valid: true };
}

/**
 * Validate file extension matches MIME type
 */
export function validateFileExtension(
  fileName: string,
  fileType: string,
): {
  valid: boolean;
  error?: string;
} {
  const fileExt = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

  if (!fileExt) {
    return {
      valid: false,
      error: "File must have an extension",
    };
  }

  const mimeInfo = ALLOWED_MIME_TYPES[fileType as keyof typeof ALLOWED_MIME_TYPES];
  if (mimeInfo && mimeInfo.ext !== fileExt) {
    return {
      valid: false,
      error: `File extension '${fileExt}' does not match file type '${fileType}'`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  fileName: string,
  fileType: string,
  fileSize: number,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const nameValidation = validateFileName(fileName);
  if (!nameValidation.valid && nameValidation.error) {
    errors.push(nameValidation.error);
  }

  const sizeValidation = validateFileSize(fileSize);
  if (!sizeValidation.valid && sizeValidation.error) {
    errors.push(sizeValidation.error);
  }

  const typeValidation = validateFileType(fileType);
  if (!typeValidation.valid && typeValidation.error) {
    errors.push(typeValidation.error);
  }

  const extValidation = validateFileExtension(fileName, fileType);
  if (!extValidation.valid && extValidation.error) {
    errors.push(extValidation.error);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
