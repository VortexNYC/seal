/**
 * Document upload configuration and validation
 */

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Allowed MIME types organized by category
 */
export const ALLOWED_MIME_TYPES = {
	// Documents
	"application/pdf": { ext: ".pdf", name: "PDF" },
	"application/msword": { ext: ".doc", name: "Word Document" },
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
		ext: ".docx",
		name: "Word Document",
	},
	"application/vnd.ms-excel": { ext: ".xls", name: "Excel Spreadsheet" },
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
		ext: ".xlsx",
		name: "Excel Spreadsheet",
	},
	"application/vnd.ms-powerpoint": { ext: ".ppt", name: "PowerPoint" },
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": {
		ext: ".pptx",
		name: "PowerPoint",
	},
	"text/plain": { ext: ".txt", name: "Text File" },
	"text/csv": { ext: ".csv", name: "CSV File" },

	// Images
	"image/jpeg": { ext: ".jpg", name: "JPEG Image" },
	"image/png": { ext: ".png", name: "PNG Image" },
	"image/gif": { ext: ".gif", name: "GIF Image" },
	"image/webp": { ext: ".webp", name: "WebP Image" },
	"image/svg+xml": { ext: ".svg", name: "SVG Image" },

	// Archives
	"application/zip": { ext: ".zip", name: "ZIP Archive" },
	"application/x-rar-compressed": { ext: ".rar", name: "RAR Archive" },
	"application/x-7z-compressed": { ext: ".7z", name: "7-Zip Archive" },

	// Audio
	"audio/mpeg": { ext: ".mp3", name: "MP3 Audio" },
	"audio/wav": { ext: ".wav", name: "WAV Audio" },
	"audio/ogg": { ext: ".ogg", name: "OGG Audio" },

	// Video
	"video/mp4": { ext: ".mp4", name: "MP4 Video" },
	"video/webm": { ext: ".webm", name: "WebM Video" },
	"video/ogg": { ext: ".ogv", name: "OGG Video" },
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
 */
export function getSupportedFileTypesDisplay(): string {
	const categories = {
		Documents: ["PDF", "Word", "Excel", "PowerPoint", "Text", "CSV"],
		Images: ["JPEG", "PNG", "GIF", "WebP", "SVG"],
		Archives: ["ZIP", "RAR", "7-Zip"],
		Media: ["MP3", "WAV", "MP4", "WebM"],
	};

	return Object.entries(categories)
		.map(([category, types]) => `${category}: ${types.join(", ")}`)
		.join(" • ");
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): {
	valid: boolean;
	error?: string;
} {
	if (fileSize > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File size exceeds maximum allowed size of ${getMaxFileSizeDisplay()}`,
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
			error: `File type '${fileType}' is not supported. Supported types: ${getSupportedFileTypesDisplay()}`,
		};
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

	const mimeInfo =
		ALLOWED_MIME_TYPES[fileType as keyof typeof ALLOWED_MIME_TYPES];
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
