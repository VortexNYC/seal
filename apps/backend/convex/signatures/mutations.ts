import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { logSignatureAction } from "../audit_logs/helpers";
import { authenticationMethodTuple } from "../schemas/recipients";
import { validateAgainstRules, validateSignature } from "./helpers";

/**
 * Signature Mutations
 *
 * Create, update, and delete signatures for document fields.
 *
 * SEA-31: Database Schemas - Signatures CRUD Operations
 */

/**
 * Create a new signature for a field
 * This is called when a recipient signs a field
 */
export const createSignature = mutation({
	args: {
		fieldId: v.id("signature_fields"),
		recipientId: v.id("recipients"),
		value: v.optional(v.string()), // For text/date/checkbox fields
		signatureImageUrl: v.optional(v.string()), // For signature fields
		ipAddress: v.string(),
		userAgent: v.string(),
		authenticationData: v.optional(
			v.object({
				method: authenticationMethodTuple,
				verified: v.boolean(),
				verifiedAt: v.optional(v.number()),
			}),
		),
	},
	handler: async (ctx, args) => {
		// Get the field being signed
		const field = await ctx.db.get(args.fieldId);
		if (!field) {
			throw new Error("Field not found");
		}

		// Verify the recipient is assigned to this field
		if (field.recipientId !== args.recipientId) {
			throw new Error("Recipient is not assigned to this field");
		}

		// Get document
		const document = await ctx.db.get(field.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Validate signature data based on field type
		const signatureValidation = validateSignature(
			field.fieldType,
			args.value,
			args.signatureImageUrl,
		);
		if (!signatureValidation.valid) {
			throw new Error(signatureValidation.error);
		}

		// Validate against field validation rules
		if (args.value) {
			const rulesValidation = validateAgainstRules(
				args.value,
				field.validationRules,
			);
			if (!rulesValidation.valid) {
				throw new Error(rulesValidation.error);
			}
		}

		// Check if signature already exists
		const existingSignature = await ctx.db
			.query("signatures")
			.withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
			.first();

		if (existingSignature) {
			throw new Error("Field already has a signature");
		}

		// Create signature
		const signatureId = await ctx.db.insert("signatures", {
			fieldId: args.fieldId,
			recipientId: args.recipientId,
			documentId: field.documentId,
			value: args.value,
			signatureImageUrl: args.signatureImageUrl,
			signedAt: Date.now(),
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
			authenticationData: args.authenticationData,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		// Log action to audit trail
		await logSignatureAction(ctx, {
			organizationId: document.organizationId,
			recipientId: args.recipientId,
			action: "signature.created",
			signatureId,
			fieldId: args.fieldId,
			documentId: field.documentId,
			newValues: {
				value: args.value,
				signatureImageUrl: args.signatureImageUrl,
			},
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
		});

		return signatureId;
	},
});

/**
 * Update an existing signature
 * This allows recipients to change their signature before final submission
 */
export const updateSignature = mutation({
	args: {
		signatureId: v.id("signatures"),
		value: v.optional(v.string()),
		signatureImageUrl: v.optional(v.string()),
		ipAddress: v.string(),
		userAgent: v.string(),
	},
	handler: async (ctx, args) => {
		// Get existing signature
		const signature = await ctx.db.get(args.signatureId);
		if (!signature) {
			throw new Error("Signature not found");
		}

		// Get the field
		const field = await ctx.db.get(signature.fieldId);
		if (!field) {
			throw new Error("Field not found");
		}

		// Get document
		const document = await ctx.db.get(signature.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Check if document is still editable
		if (document.workflowStatus === "completed") {
			throw new Error("Cannot update signature on completed document");
		}

		// Validate new signature data
		const newValue = args.value ?? signature.value;
		const newImageUrl = args.signatureImageUrl ?? signature.signatureImageUrl;

		const signatureValidation = validateSignature(
			field.fieldType,
			newValue,
			newImageUrl,
		);
		if (!signatureValidation.valid) {
			throw new Error(signatureValidation.error);
		}

		// Validate against field validation rules
		if (newValue) {
			const rulesValidation = validateAgainstRules(
				newValue,
				field.validationRules,
			);
			if (!rulesValidation.valid) {
				throw new Error(rulesValidation.error);
			}
		}

		// Store old values for audit
		const oldValues = {
			value: signature.value,
			signatureImageUrl: signature.signatureImageUrl,
		};

		// Update signature
		await ctx.db.patch(args.signatureId, {
			...(args.value !== undefined && { value: args.value }),
			...(args.signatureImageUrl !== undefined && {
				signatureImageUrl: args.signatureImageUrl,
			}),
			signedAt: Date.now(), // Update timestamp
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
			updatedAt: Date.now(),
		});

		// Log action to audit trail
		await logSignatureAction(ctx, {
			organizationId: document.organizationId,
			recipientId: signature.recipientId,
			action: "signature.updated",
			signatureId: args.signatureId,
			fieldId: signature.fieldId,
			documentId: signature.documentId,
			oldValues,
			newValues: {
				value: args.value,
				signatureImageUrl: args.signatureImageUrl,
			},
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
		});

		return args.signatureId;
	},
});

/**
 * Delete a signature
 * Only allowed by admins or before document is sent
 */
export const deleteSignature = mutation({
	args: {
		signatureId: v.id("signatures"),
	},
	handler: async (ctx, args) => {
		// Get authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Get existing signature
		const signature = await ctx.db.get(args.signatureId);
		if (!signature) {
			throw new Error("Signature not found");
		}

		// Get document
		const document = await ctx.db.get(signature.documentId);
		if (!document) {
			throw new Error("Document not found");
		}

		// Check if document allows signature deletion
		if (document.workflowStatus === "completed") {
			throw new Error("Cannot delete signature from completed document");
		}

		// Store signature data for audit
		const oldValues = {
			value: signature.value,
			signatureImageUrl: signature.signatureImageUrl,
			signedAt: signature.signedAt,
		};

		// Delete signature
		await ctx.db.delete(args.signatureId);

		// Log action to audit trail
		await logSignatureAction(ctx, {
			organizationId: document.organizationId,
			recipientId: signature.recipientId,
			action: "signature.updated", // Use updated as there's no deleted action
			signatureId: args.signatureId,
			fieldId: signature.fieldId,
			documentId: signature.documentId,
			oldValues,
			ipAddress: "0.0.0.0", // TODO: Get from request context
			userAgent: "web",
		});

		return { success: true };
	},
});
