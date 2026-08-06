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
 * Validate file extension matches MIME type
 */
export function validateFileExtension(
  fileName: string,
  fileType: string
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

  const mimeInfoByType: Record<
    string,
    (typeof ALLOWED_MIME_TYPES)[keyof typeof ALLOWED_MIME_TYPES] | undefined
  > = ALLOWED_MIME_TYPES;
  const mimeInfo = mimeInfoByType[fileType];
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
  fileSize: number
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

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
