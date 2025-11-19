import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { logFieldAction } from "../audit_logs/helpers";
import { fieldTypeTuple } from "../schemas/signature_fields";
import {
	validateFieldAssignment,
	validateFieldPosition,
	validateFieldType,
	validatePageNumber,
} from "./helpers";

/**
 * Signature Field Mutations
 *
 * Create, update, delete, and reposition signature fields on documents.
 *
 * SEA-31: Database Schemas - Signature Fields CRUD Operations
 */

/**
 * Create a new signature field on a document
 */
export const createField = mutation({
	args: {
		documentId: v.id("documents"),
		recipientId: v.id("document_recipients"),
		fieldType: fieldTypeTuple,
		label: v.string(),
		isRequired: v.boolean(),
		x: v.number(),
		y: v.number(),
		width: v.number(),
		height: v.number(),
		page: v.number(),
		properties: v.optional(
			v.object({
				placeholder: v.optional(v.string()),
				defaultValue: v.optional(v.string()),
				options: v.optional(v.array(v.string())),
				maxLength: v.optional(v.number()),
				minLength: v.optional(v.number()),
				pattern: v.optional(v.string()),
				helpText: v.optional(v.string()),
			}),
		),
		validationRules: v.optional(
			v.object({
				required: v.optional(v.boolean()),
				min: v.optional(v.number()),
				max: v.optional(v.number()),
				pattern: v.optional(v.string()),
				customMessage: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Get document and verify access
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Validate field position
		const positionValidation = validateFieldPosition(
			args.x,
			args.y,
			args.width,
			args.height,
		);
		if (!positionValidation.valid) {
			throw new Error(positionValidation.error);
		}

		// Validate page number
		const pageValidation = await validatePageNumber(
			ctx,
			args.documentId,
			args.page,
		);
		if (!pageValidation.valid) {
			throw new Error(pageValidation.error);
		}

		// Validate field assignment to recipient
		const assignmentValidation = await validateFieldAssignment(
			ctx,
			args.documentId,
			args.recipientId,
		);
		if (!assignmentValidation.valid) {
			throw new Error(assignmentValidation.error);
		}

		// Validate field type and properties
		const typeValidation = validateFieldType(args.fieldType, args.properties);
		if (!typeValidation.valid) {
			throw new Error(typeValidation.error);
		}

		// Create field
		const fieldId = await ctx.db.insert("signature_fields", {
			documentId: args.documentId,
			recipientId: args.recipientId,
			fieldType: args.fieldType,
			label: args.label,
			isRequired: args.isRequired,
			x: args.x,
			y: args.y,
			width: args.width,
			height: args.height,
			page: args.page,
			properties: args.properties,
			validationRules: args.validationRules,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		// Log action to audit trail
		await logFieldAction(ctx, {
			organizationId: document.organizationId,
			userId: identity.subject,
			action: "field.created",
			fieldId,
			documentId: args.documentId,
			recipientId: args.recipientId,
			newValues: { fieldType: args.fieldType, label: args.label },
			ipAddress: "0.0.0.0", // TODO: Get from request context
			userAgent: "web",
		});

		return fieldId;
	},
});

/**
 * Update a signature field's properties
 */
export const updateField = mutation({
	args: {
		fieldId: v.id("signature_fields"),
		label: v.optional(v.string()),
		isRequired: v.optional(v.boolean()),
		properties: v.optional(
			v.object({
				placeholder: v.optional(v.string()),
				defaultValue: v.optional(v.string()),
				options: v.optional(v.array(v.string())),
				maxLength: v.optional(v.number()),
				minLength: v.optional(v.number()),
				pattern: v.optional(v.string()),
				helpText: v.optional(v.string()),
			}),
		),
		validationRules: v.optional(
			v.object({
				required: v.optional(v.boolean()),
				min: v.optional(v.number()),
				max: v.optional(v.number()),
				pattern: v.optional(v.string()),
				customMessage: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Get existing field
		const field = await ctx.db.get(args.fieldId);
		if (!field) {
			throw new Error("Field not found");
		}

		// Get document and verify access
		const document = await ctx.db.get(field.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Validate field type if properties are being updated
		if (args.properties) {
			const typeValidation = validateFieldType(
				field.fieldType,
				args.properties,
			);
			if (!typeValidation.valid) {
				throw new Error(typeValidation.error);
			}
		}

		// Store old values for audit
		const oldValues = {
			label: field.label,
			isRequired: field.isRequired,
			properties: field.properties,
			validationRules: field.validationRules,
		};

		// Update field
		await ctx.db.patch(args.fieldId, {
			...(args.label !== undefined && { label: args.label }),
			...(args.isRequired !== undefined && { isRequired: args.isRequired }),
			...(args.properties !== undefined && { properties: args.properties }),
			...(args.validationRules !== undefined && {
				validationRules: args.validationRules,
			}),
			updatedAt: Date.now(),
		});

		// Log action to audit trail
		await logFieldAction(ctx, {
			organizationId: document.organizationId,
			userId: identity.subject,
			action: "field.updated",
			fieldId: args.fieldId,
			documentId: field.documentId,
			recipientId: field.recipientId,
			oldValues,
			newValues: {
				label: args.label,
				isRequired: args.isRequired,
				properties: args.properties,
				validationRules: args.validationRules,
			},
			ipAddress: "0.0.0.0", // TODO: Get from request context
			userAgent: "web",
		});

		return args.fieldId;
	},
});

/**
 * Reposition a signature field (move or resize)
 */
export const repositionField = mutation({
	args: {
		fieldId: v.id("signature_fields"),
		x: v.optional(v.number()),
		y: v.optional(v.number()),
		width: v.optional(v.number()),
		height: v.optional(v.number()),
		page: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Get existing field
		const field = await ctx.db.get(args.fieldId);
		if (!field) {
			throw new Error("Field not found");
		}

		// Get document and verify access
		const document = await ctx.db.get(field.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Calculate new position (use existing values if not provided)
		const newX = args.x ?? field.x;
		const newY = args.y ?? field.y;
		const newWidth = args.width ?? field.width;
		const newHeight = args.height ?? field.height;
		const newPage = args.page ?? field.page;

		// Validate new position
		const positionValidation = validateFieldPosition(
			newX,
			newY,
			newWidth,
			newHeight,
		);
		if (!positionValidation.valid) {
			throw new Error(positionValidation.error);
		}

		// Validate page number if changed
		if (args.page !== undefined) {
			const pageValidation = await validatePageNumber(
				ctx,
				field.documentId,
				args.page,
			);
			if (!pageValidation.valid) {
				throw new Error(pageValidation.error);
			}
		}

		// Store old values for audit
		const oldValues = {
			x: field.x,
			y: field.y,
			width: field.width,
			height: field.height,
			page: field.page,
		};

		// Update field position
		await ctx.db.patch(args.fieldId, {
			x: newX,
			y: newY,
			width: newWidth,
			height: newHeight,
			page: newPage,
			updatedAt: Date.now(),
		});

		// Log action to audit trail
		await logFieldAction(ctx, {
			organizationId: document.organizationId,
			userId: identity.subject,
			action: "field.updated",
			fieldId: args.fieldId,
			documentId: field.documentId,
			recipientId: field.recipientId,
			oldValues,
			newValues: {
				x: newX,
				y: newY,
				width: newWidth,
				height: newHeight,
				page: newPage,
			},
			ipAddress: "0.0.0.0", // TODO: Get from request context
			userAgent: "web",
		});

		return args.fieldId;
	},
});

/**
 * Delete a signature field
 */
export const deleteField = mutation({
	args: {
		fieldId: v.id("signature_fields"),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Get existing field
		const field = await ctx.db.get(args.fieldId);
		if (!field) {
			throw new Error("Field not found");
		}

		// Get document and verify access
		const document = await ctx.db.get(field.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Check if field has signatures
		const signatures = await ctx.db
			.query("signatures")
			.withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
			.collect();

		if (signatures.length > 0) {
			throw new Error("Cannot delete field that has been signed");
		}

		// Store field data for audit
		const oldValues = {
			fieldType: field.fieldType,
			label: field.label,
			position: {
				x: field.x,
				y: field.y,
				width: field.width,
				height: field.height,
			},
		};

		// Delete field
		await ctx.db.delete(args.fieldId);

		// Log action to audit trail
		await logFieldAction(ctx, {
			organizationId: document.organizationId,
			userId: identity.subject,
			action: "field.deleted",
			fieldId: args.fieldId,
			documentId: field.documentId,
			recipientId: field.recipientId,
			oldValues,
			ipAddress: "0.0.0.0", // TODO: Get from request context
			userAgent: "web",
		});

		return { success: true };
	},
});

/**
 * Create multiple fields at once (useful for templates)
 */
export const bulkCreateFields = mutation({
	args: {
		fields: v.array(
			v.object({
				documentId: v.id("documents"),
				recipientId: v.id("document_recipients"),
				fieldType: fieldTypeTuple,
				label: v.string(),
				isRequired: v.boolean(),
				x: v.number(),
				y: v.number(),
				width: v.number(),
				height: v.number(),
				page: v.number(),
				properties: v.optional(
					v.object({
						placeholder: v.optional(v.string()),
						defaultValue: v.optional(v.string()),
						options: v.optional(v.array(v.string())),
						maxLength: v.optional(v.number()),
						minLength: v.optional(v.number()),
						pattern: v.optional(v.string()),
						helpText: v.optional(v.string()),
					}),
				),
			}),
		),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		const fieldIds: Id<"signature_fields">[] = [];

		// Create all fields
		for (const fieldData of args.fields) {
			// Validate position
			const positionValidation = validateFieldPosition(
				fieldData.x,
				fieldData.y,
				fieldData.width,
				fieldData.height,
			);
			if (!positionValidation.valid) {
				throw new Error(
					`Field "${fieldData.label}": ${positionValidation.error}`,
				);
			}

			// Validate page number
			const pageValidation = await validatePageNumber(
				ctx,
				fieldData.documentId,
				fieldData.page,
			);
			if (!pageValidation.valid) {
				throw new Error(`Field "${fieldData.label}": ${pageValidation.error}`);
			}

			// Validate field assignment
			const assignmentValidation = await validateFieldAssignment(
				ctx,
				fieldData.documentId,
				fieldData.recipientId,
			);
			if (!assignmentValidation.valid) {
				throw new Error(
					`Field "${fieldData.label}": ${assignmentValidation.error}`,
				);
			}

			// Validate field type
			const typeValidation = validateFieldType(
				fieldData.fieldType,
				fieldData.properties,
			);
			if (!typeValidation.valid) {
				throw new Error(`Field "${fieldData.label}": ${typeValidation.error}`);
			}

			// Create field
			const fieldId = await ctx.db.insert("signature_fields", {
				...fieldData,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});

			fieldIds.push(fieldId);
		}

		return { fieldIds, count: fieldIds.length };
	},
});
