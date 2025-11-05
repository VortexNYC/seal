/**
 * Frontend file upload validation
 * Mirrors backend validation in convex/documents/upload_config.ts
 */

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Allowed file extensions for file input accept attribute
 */
export const ALLOWED_FILE_EXTENSIONS = [
	// Documents
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	".txt",
	".csv",
	// Images
	".jpg",
	".jpeg",
	".png",
	".gif",
	".webp",
	".svg",
	// Archives
	".zip",
	".rar",
	".7z",
	// Audio
	".mp3",
	".wav",
	".ogg",
	// Video
	".mp4",
	".webm",
	".ogv",
].join(",");

/**
 * Allowed MIME types
 */
const ALLOWED_MIME_TYPES = new Set([
	// Documents
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/plain",
	"text/csv",
	// Images
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	// Archives
	"application/zip",
	"application/x-rar-compressed",
	"application/x-7z-compressed",
	// Audio
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
	// Video
	"video/mp4",
	"video/webm",
	"video/ogg",
]);

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
	return "Documents (PDF, Word, Excel, PowerPoint), Images (JPEG, PNG, GIF), Archives (ZIP, RAR), Media (MP3, MP4)";
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
			`File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${getMaxFileSizeDisplay()}`,
		);
	}

	// Validate MIME type
	if (!file.type) {
		errors.push("File type could not be determined");
	} else if (!ALLOWED_MIME_TYPES.has(file.type)) {
		errors.push(
			`File type '${file.type}' is not supported. Supported: ${getSupportedFileTypesDisplay()}`,
		);
	}

	// Validate extension
	const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
	if (!fileExt) {
		errors.push("File must have an extension");
	} else if (!ALLOWED_FILE_EXTENSIONS.includes(fileExt)) {
		errors.push(`File extension '${fileExt}' is not allowed`);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
