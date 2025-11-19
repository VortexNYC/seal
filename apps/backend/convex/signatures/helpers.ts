import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Signature Helper Functions
 *
 * Utilities for signature validation and verification.
 *
 * SEA-31: Database Schemas - Signatures Implementation
 */

/**
 * Validate signature data based on field type
 */
export function validateSignature(
	fieldType: string,
	value?: string,
	signatureImageUrl?: string,
): { valid: boolean; error?: string } {
	// Signature fields must have an image URL
	if (fieldType === "signature" || fieldType === "initial") {
		if (!signatureImageUrl) {
			return {
				valid: false,
				error: "Signature fields must have an image URL",
			};
		}
		return { valid: true };
	}

	// Text, date, and other fields must have a value
	if (fieldType === "text" || fieldType === "date") {
		if (!value || value.trim() === "") {
			return { valid: false, error: `${fieldType} field cannot be empty` };
		}
		return { valid: true };
	}

	// Checkbox can be empty (unchecked)
	if (fieldType === "checkbox") {
		return { valid: true };
	}

	// Dropdown and radio must have a value
	if (fieldType === "dropdown" || fieldType === "radio") {
		if (!value || value.trim() === "") {
			return {
				valid: false,
				error: `${fieldType} field must have a selection`,
			};
		}
		return { valid: true };
	}

	return { valid: true };
}

/**
 * Check if a field has been completed (has a valid signature)
 */
export async function checkFieldCompleted(
	ctx: QueryCtx,
	fieldId: Id<"signature_fields">,
): Promise<boolean> {
	const signature = await ctx.db
		.query("signatures")
		.withIndex("by_field", (q) => q.eq("fieldId", fieldId))
		.first();

	return signature !== null;
}

/**
 * Validate signature against field validation rules
 */
export function validateAgainstRules(
	value: string | undefined,
	validationRules?: {
		required?: boolean;
		min?: number;
		max?: number;
		pattern?: string;
		customMessage?: string;
	},
): { valid: boolean; error?: string } {
	if (!validationRules) {
		return { valid: true };
	}

	// Check required
	if (validationRules.required && (!value || value.trim() === "")) {
		return {
			valid: false,
			error: validationRules.customMessage || "This field is required",
		};
	}

	if (!value) {
		return { valid: true };
	}

	// Check min length
	if (validationRules.min !== undefined && value.length < validationRules.min) {
		return {
			valid: false,
			error:
				validationRules.customMessage ||
				`Minimum length is ${validationRules.min} characters`,
		};
	}

	// Check max length
	if (validationRules.max !== undefined && value.length > validationRules.max) {
		return {
			valid: false,
			error:
				validationRules.customMessage ||
				`Maximum length is ${validationRules.max} characters`,
		};
	}

	// Check pattern
	if (validationRules.pattern) {
		const regex = new RegExp(validationRules.pattern);
		if (!regex.test(value)) {
			return {
				valid: false,
				error:
					validationRules.customMessage ||
					"Value does not match required pattern",
			};
		}
	}

	return { valid: true };
}

/**
 * Get completion status for a document
 * Returns percentage and list of incomplete required fields
 */
export async function getDocumentCompletionStatus(
	ctx: QueryCtx,
	documentId: Id<"documents">,
): Promise<{
	completionPercentage: number;
	totalFields: number;
	completedFields: number;
	requiredFieldsComplete: boolean;
	incompleteRequiredFields: Doc<"signature_fields">[];
}> {
	// Get all fields for the document
	const fields = await ctx.db
		.query("signature_fields")
		.withIndex("by_document", (q) => q.eq("documentId", documentId))
		.collect();

	let completedCount = 0;
	const incompleteRequiredFields: Doc<"signature_fields">[] = [];

	for (const field of fields) {
		const isCompleted = await checkFieldCompleted(ctx, field._id);

		if (isCompleted) {
			completedCount++;
		} else if (field.isRequired) {
			incompleteRequiredFields.push(field);
		}
	}

	const completionPercentage =
		fields.length > 0 ? (completedCount / fields.length) * 100 : 0;
	const requiredFieldsComplete = incompleteRequiredFields.length === 0;

	return {
		completionPercentage,
		totalFields: fields.length,
		completedFields: completedCount,
		requiredFieldsComplete,
		incompleteRequiredFields,
	};
}

/**
 * Check if a recipient has completed all their assigned fields
 */
export async function checkRecipientComplete(
	ctx: QueryCtx,
	documentId: Id<"documents">,
	recipientId: Id<"document_recipients">,
): Promise<{
	complete: boolean;
	totalFields: number;
	completedFields: number;
	incompleteFields: Doc<"signature_fields">[];
}> {
	// Get all fields assigned to this recipient
	const fields = await ctx.db
		.query("signature_fields")
		.withIndex("by_document_recipient", (q) =>
			q.eq("documentId", documentId).eq("recipientId", recipientId),
		)
		.collect();

	let completedCount = 0;
	const incompleteFields: Doc<"signature_fields">[] = [];

	for (const field of fields) {
		const isCompleted = await checkFieldCompleted(ctx, field._id);

		if (isCompleted) {
			completedCount++;
		} else {
			incompleteFields.push(field);
		}
	}

	return {
		complete: incompleteFields.length === 0,
		totalFields: fields.length,
		completedFields: completedCount,
		incompleteFields,
	};
}
