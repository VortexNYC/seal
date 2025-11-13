import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { FieldType } from "../schemas/signature_fields";

/**
 * Signature Field Helper Functions
 *
 * Utilities for field validation, coordinate conversion, and field operations.
 *
 * SEA-31: Database Schemas - Signature Fields Implementation
 */

/**
 * Validate field position is within page bounds
 * Coordinates are stored as percentages (0-100)
 */
export function validateFieldPosition(
	x: number,
	y: number,
	width: number,
	height: number,
): { valid: boolean; error?: string } {
	if (x < 0 || x > 100) {
		return { valid: false, error: "X coordinate must be between 0 and 100" };
	}

	if (y < 0 || y > 100) {
		return { valid: false, error: "Y coordinate must be between 0 and 100" };
	}

	if (width <= 0 || width > 100) {
		return { valid: false, error: "Width must be between 0 and 100" };
	}

	if (height <= 0 || height > 100) {
		return { valid: false, error: "Height must be between 0 and 100" };
	}

	// Check if field would extend beyond page bounds
	if (x + width > 100) {
		return {
			valid: false,
			error: "Field extends beyond right page boundary",
		};
	}

	if (y + height > 100) {
		return {
			valid: false,
			error: "Field extends beyond bottom page boundary",
		};
	}

	return { valid: true };
}

/**
 * Validate field assignment to recipient
 * Ensures recipient exists and belongs to the document
 */
export async function validateFieldAssignment(
	ctx: QueryCtx,
	documentId: Id<"documents">,
	recipientId: Id<"recipients">,
): Promise<{ valid: boolean; error?: string }> {
	const recipient = await ctx.db.get(recipientId);

	if (!recipient) {
		return { valid: false, error: "Recipient not found" };
	}

	// Check if recipient is associated with this document
	if (recipient.documentId !== documentId) {
		return {
			valid: false,
			error: "Recipient not associated with this document",
		};
	}

	return { valid: true };
}

/**
 * Validate field type and properties
 */
export function validateFieldType(
	fieldType: FieldType,
	properties?: {
		placeholder?: string;
		defaultValue?: string;
		options?: string[];
		maxLength?: number;
		minLength?: number;
		pattern?: string;
		helpText?: string;
	},
): { valid: boolean; error?: string } {
	// Dropdown and radio fields must have options
	if (fieldType === "dropdown" || fieldType === "radio") {
		if (!properties?.options || properties.options.length === 0) {
			return {
				valid: false,
				error: `${fieldType} fields must have at least one option`,
			};
		}
	}

	// Validate maxLength is greater than minLength
	if (
		properties?.maxLength !== undefined &&
		properties?.minLength !== undefined
	) {
		if (properties.maxLength < properties.minLength) {
			return {
				valid: false,
				error: "maxLength must be greater than minLength",
			};
		}
	}

	return { valid: true };
}

/**
 * Validate page number is within document bounds
 */
export async function validatePageNumber(
	ctx: QueryCtx,
	documentId: Id<"documents">,
	pageNumber: number,
): Promise<{ valid: boolean; error?: string }> {
	const document = await ctx.db.get(documentId);

	if (!document) {
		return { valid: false, error: "Document not found" };
	}

	if (pageNumber < 1) {
		return { valid: false, error: "Page number must be at least 1" };
	}

	if (document.pageCount && pageNumber > document.pageCount) {
		return {
			valid: false,
			error: `Page number exceeds document page count (${document.pageCount})`,
		};
	}

	return { valid: true };
}

/**
 * Convert pixel coordinates to percentage coordinates
 * Used when placing fields from canvas (which uses pixels) to database (which uses percentages)
 */
export function pixelsToPercentage(
	pixels: number,
	totalPixels: number,
): number {
	return (pixels / totalPixels) * 100;
}

/**
 * Convert percentage coordinates to pixel coordinates
 * Used when rendering fields on canvas from database
 */
export function percentageToPixels(
	percentage: number,
	totalPixels: number,
): number {
	return (percentage / 100) * totalPixels;
}

/**
 * Calculate field bounds in pixels for a given page size
 */
export function calculateFieldBounds(
	field: {
		x: number;
		y: number;
		width: number;
		height: number;
	},
	pageWidth: number,
	pageHeight: number,
): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	return {
		x: percentageToPixels(field.x, pageWidth),
		y: percentageToPixels(field.y, pageHeight),
		width: percentageToPixels(field.width, pageWidth),
		height: percentageToPixels(field.height, pageHeight),
	};
}

/**
 * Check if two fields overlap
 * Used for validation and field placement suggestions
 */
export function fieldsOverlap(
	field1: { x: number; y: number; width: number; height: number },
	field2: { x: number; y: number; width: number; height: number },
): boolean {
	return !(
		field1.x + field1.width < field2.x ||
		field2.x + field2.width < field1.x ||
		field1.y + field1.height < field2.y ||
		field2.y + field2.height < field1.y
	);
}
