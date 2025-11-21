import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";

/**
 * Signature Field Queries
 *
 * Retrieve signature fields by document, recipient, page, or ID.
 *
 * SEA-31: Database Schemas - Signature Fields Query Operations
 */

/**
 * Get all fields for a specific document
 */
export const getFieldsByDocument = query({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		return fields;
	},
});

/**
 * Get all fields assigned to a specific recipient
 */
export const getFieldsByRecipient = query({
	args: {
		recipientId: v.id("document_recipients"),
	},
	handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
			.collect();

		return fields;
	},
});

/**
 * Get all fields on a specific page of a document
 */
export const getFieldsByPage = query({
	args: {
		documentId: v.id("documents"),
		page: v.number(),
	},
	handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document_page", (q) =>
				q.eq("documentId", args.documentId).eq("page", args.page),
			)
			.collect();

		return fields;
	},
});

/**
 * Get all fields for a document assigned to a specific recipient
 */
export const getFieldsByDocumentAndRecipient = query({
	args: {
		documentId: v.id("documents"),
		recipientId: v.id("document_recipients"),
	},
	handler: async (ctx, args): Promise<Doc<"signature_fields">[]> => {
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document_recipient", (q) =>
				q.eq("documentId", args.documentId).eq("recipientId", args.recipientId),
			)
			.collect();

		return fields;
	},
});

/**
 * Get a single field by ID
 */
export const getFieldById = query({
	args: {
		fieldId: v.id("signature_fields"),
	},
	handler: async (ctx, args): Promise<Doc<"signature_fields"> | null> => {
		const field = await ctx.db.get(args.fieldId);
		return field;
	},
});

/**
 * Get field with recipient details
 */
export const getFieldWithRecipient = query({
	args: {
		fieldId: v.id("signature_fields"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		field: Doc<"signature_fields">;
		recipient: Doc<"document_recipients"> | null;
	} | null> => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) {
			return null;
		}

		const recipient = await ctx.db.get(field.recipientId);

		return {
			field,
			recipient,
		};
	},
});

/**
 * Get count of fields by document
 */
export const getFieldCountByDocument = query({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args): Promise<number> => {
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		return fields.length;
	},
});

/**
 * Get count of required vs optional fields for a document
 */
export const getFieldStatsByDocument = query({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		total: number;
		required: number;
		optional: number;
		byType: Record<string, number>;
	}> => {
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const required = fields.filter((f) => f.isRequired).length;
		const optional = fields.length - required;

		// Count by field type
		const byType: Record<string, number> = {};
		for (const field of fields) {
			byType[field.fieldType] = (byType[field.fieldType] || 0) + 1;
		}

		return {
			total: fields.length,
			required,
			optional,
			byType,
		};
	},
});

/**
 * Check if all required fields have been filled (have signatures)
 */
export const checkRequiredFieldsComplete = query({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		complete: boolean;
		totalRequired: number;
		completedRequired: number;
		missingFields: Doc<"signature_fields">[];
	}> => {
		// Get all required fields for the document
		const allFields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const requiredFields = allFields.filter((f) => f.isRequired);

		// Check which required fields have signatures
		const missingFields: Doc<"signature_fields">[] = [];

		for (const field of requiredFields) {
			const signature = await ctx.db
				.query("signatures")
				.withIndex("by_field", (q) => q.eq("fieldId", field._id))
				.first();

			if (!signature) {
				missingFields.push(field);
			}
		}

		const completedRequired = requiredFields.length - missingFields.length;

		return {
			complete: missingFields.length === 0,
			totalRequired: requiredFields.length,
			completedRequired,
			missingFields,
		};
	},
});

/**
 * Internal query to get signature fields by document ID without access control
 * Used by actions that need to access signature fields
 */
import { internalQuery } from "../_generated/server";

export const getFieldsByDocumentInternal = internalQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();
	},
});
