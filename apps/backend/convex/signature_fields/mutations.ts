import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
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
 * Verify that document is in draft status before allowing field modifications
 */
function verifyDocumentIsDraft(document: Doc<"documents">): void {
	const workflowStatus = document.workflowStatus ?? "draft";
	if (workflowStatus !== "draft") {
		throw new ConvexError(
			`Cannot modify fields - document is ${workflowStatus}. Fields can only be modified in draft status.`,
		);
	}
}

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
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
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

		// Verify document is in draft status
		verifyDocumentIsDraft(document);

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

		// Auto-designate main signature if this is the first signature field for this recipient
		let isMainSignature: boolean | undefined;
		if (args.fieldType === "signature") {
			// Check how many signature fields this recipient already has
			const existingSignatureFields = await ctx.db
				.query("signature_fields")
				.withIndex("by_document_recipient", (q) =>
					q
						.eq("documentId", args.documentId)
						.eq("recipientId", args.recipientId),
				)
				.filter((q) => q.eq(q.field("fieldType"), "signature"))
				.collect();

			// If this is the first signature field, make it the main one
			if (existingSignatureFields.length === 0) {
				isMainSignature = true;
			}
		}

		// Create field
		const fieldId = await ctx.db.insert("signature_fields", {
			documentId: args.documentId,
			recipientId: args.recipientId,
			fieldType: args.fieldType,
			label: args.label,
			isRequired: args.isRequired,
			isMainSignature,
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
			ipAddress: args.ipAddress ?? "web-authenticated",
			userAgent: args.userAgent ?? "web",
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
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
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

		// Verify document is in draft status
		verifyDocumentIsDraft(document);

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
			ipAddress: args.ipAddress ?? "web-authenticated",
			userAgent: args.userAgent ?? "web",
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
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
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

		// Verify document is in draft status
		verifyDocumentIsDraft(document);

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
			ipAddress: args.ipAddress ?? "web-authenticated",
			userAgent: args.userAgent ?? "web",
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
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
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

		// Verify document is in draft status
		verifyDocumentIsDraft(document);

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
			ipAddress: args.ipAddress ?? "web-authenticated",
			userAgent: args.userAgent ?? "web",
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

		// Verify all documents are in draft status before creating any fields
		const documentIds = new Set(args.fields.map((f) => f.documentId));
		for (const documentId of documentIds) {
			const document = await ctx.db.get(documentId);
			if (!document) {
				throw new Error(`Document not found: ${documentId}`);
			}
			verifyDocumentIsDraft(document);
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

/**
 * Set a signature field as the main signature for a recipient
 * Ensures only one main signature per recipient
 */
export const setMainSignature = mutation({
	args: {
		fieldId: v.id("signature_fields"),
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Get the field
		const field = await ctx.db.get(args.fieldId);
		if (!field) {
			throw new Error("Field not found");
		}

		// Verify it's a signature field
		if (field.fieldType !== "signature") {
			throw new Error("Only signature fields can be set as main signature");
		}

		// Get document and verify access
		const document = await ctx.db.get(field.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Verify document is in draft status
		verifyDocumentIsDraft(document);

		// If already main signature, nothing to do
		if (field.isMainSignature === true) {
			return { success: true, message: "Already set as main signature" };
		}

		// Find any other main signature for this recipient and unset it
		const existingMainSignature = await ctx.db
			.query("signature_fields")
			.withIndex("by_document_recipient", (q) =>
				q
					.eq("documentId", field.documentId)
					.eq("recipientId", field.recipientId),
			)
			.filter((q) =>
				q.and(
					q.eq(q.field("fieldType"), "signature"),
					q.eq(q.field("isMainSignature"), true),
				),
			)
			.first();

		if (existingMainSignature && existingMainSignature._id !== args.fieldId) {
			await ctx.db.patch(existingMainSignature._id, {
				isMainSignature: false,
				updatedAt: Date.now(),
			});
		}

		// Set this field as the main signature
		await ctx.db.patch(args.fieldId, {
			isMainSignature: true,
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
			oldValues: { isMainSignature: field.isMainSignature },
			newValues: { isMainSignature: true },
			ipAddress: args.ipAddress ?? "web-authenticated",
			userAgent: args.userAgent ?? "web",
		});

		return { success: true, message: "Main signature updated" };
	},
});
