import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Signature Fields Table Schema
 *
 * Defines fillable fields on documents (signatures, text, dates, checkboxes, etc.)
 * Each field is assigned to a specific recipient and positioned on a document page.
 *
 * Based on: /docs/design-phase/information-architecture/data-relationships.md
 * Feature: Signature Field Management - Feature #7
 */

// Field types supported in documents
export const fieldTypeTuple = v.union(
	v.literal("signature"), // Signature capture field
	v.literal("text"), // Text input field
	v.literal("date"), // Date picker field
	v.literal("checkbox"), // Checkbox field
	v.literal("dropdown"), // Dropdown select field
	v.literal("radio"), // Radio button group
	v.literal("attachment"), // File attachment field
);
export type FieldType = Infer<typeof fieldTypeTuple>;

export const signatureFieldsTable = defineTable({
	// References
	documentId: v.id("documents"), // Document this field belongs to
	recipientId: v.id("document_recipients"), // Recipient who must fill this field
	// TODO: Add templateFieldId when template_fields table is implemented
	// templateFieldId: v.optional(v.id("template_fields")), // If created from template

	// Field Configuration
	fieldType: fieldTypeTuple, // Type of field
	label: v.string(), // Field label/name
	isRequired: v.boolean(), // UI-level: Whether field is marked required for display purposes

	// Position on Document
	x: v.number(), // X coordinate (percentage of page width)
	y: v.number(), // Y coordinate (percentage of page height)
	width: v.number(), // Field width (percentage of page width)
	height: v.number(), // Field height (percentage of page height)
	page: v.number(), // Page number (1-indexed)

	// Field Properties (type-specific configuration)
	properties: v.optional(
		v.object({
			placeholder: v.optional(v.string()), // Placeholder text
			defaultValue: v.optional(v.string()), // Default value
			options: v.optional(v.array(v.string())), // Options for dropdown/radio
			maxLength: v.optional(v.number()), // Max text length
			minLength: v.optional(v.number()), // Min text length
			pattern: v.optional(v.string()), // Regex pattern for validation
			helpText: v.optional(v.string()), // Help text for field
		}),
	),

	// Validation Rules (backend-level validation with custom messages)
	validationRules: v.optional(
		v.object({
			required: v.optional(v.boolean()), // Backend validation: enforces required constraint
			min: v.optional(v.number()),
			max: v.optional(v.number()),
			pattern: v.optional(v.string()),
			customMessage: v.optional(v.string()),
		}),
	),

	// Timestamps
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_document", ["documentId"])
	.index("by_recipient", ["recipientId"])
	.index("by_document_page", ["documentId", "page"])
	.index("by_document_recipient", ["documentId", "recipientId"]);
