/**
 * Template mutations
 *
 * SEA-80/81/83: Document Templates - Mutation functions
 */

import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { permissionMutation } from "../auth";
import {
	ensureDocumentLimit,
	ensureProFeature,
} from "../auth/subscription_guards";

/**
 * Save a document as a template
 * Copies the document PDF and all signature fields
 * Requires templates:create permission
 */
export const saveAsTemplate = permissionMutation("templates:create")({
	args: {
		documentId: v.id("documents"),
		name: v.string(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;
		const organizationId = ctx.auth.organization._id;
		const now = Date.now();

		// 0. Templates require Pro plan
		await ensureProFeature(ctx.db, userId, "Templates");

		// 1. Get the source document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// Verify document belongs to the user's organization
		if (document.organizationId !== organizationId) {
			throw new ConvexError("Document not found");
		}

		// 2. Get all signature fields for this document
		const fields = await ctx.db
			.query("signature_fields")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		// 3. Create the template
		const templateId = await ctx.db.insert("templates", {
			organizationId,
			createdBy: userId,
			name: args.name,
			description: args.description,
			sourceDocumentId: args.documentId,
			storageId: document.storageId, // Share the same PDF storage
			fileSize: document.fileSize,
			fileType: document.fileType,
			pageCount: document.pageCount,
			thumbnailDataUrl: document.thumbnailDataUrl,
			useCount: 0,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});

		// 4. Copy fields to template_fields
		let fieldOrder = 0;
		for (const field of fields) {
			await ctx.db.insert("template_fields", {
				templateId,
				fieldType: field.fieldType,
				label: field.label,
				isRequired: field.isRequired,
				x: field.x,
				y: field.y,
				width: field.width,
				height: field.height,
				page: field.page,
				properties: field.properties,
				order: fieldOrder,
				createdAt: now,
				updatedAt: now,
			});
			fieldOrder++;
		}

		return { templateId, fieldCount: fields.length };
	},
});

/**
 * Create a new document from a template
 * Copies the template PDF and all fields to a new document
 * Requires templates:read and documents:create permissions
 */
export const createFromTemplate = permissionMutation("documents:create")({
	args: {
		templateId: v.id("templates"),
		documentName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;
		const organizationId = ctx.auth.organization._id;
		const now = Date.now();

		// 0. Check document creation limit
		await ensureDocumentLimit(ctx.db, userId);

		// 1. Get the template
		const template = await ctx.db.get(args.templateId);
		if (!template || template.status === "deleted") {
			throw new ConvexError("Template not found");
		}

		// Verify template belongs to the user's organization
		if (template.organizationId !== organizationId) {
			throw new ConvexError("Template not found");
		}

		// 2. Get template fields
		const templateFields = await ctx.db
			.query("template_fields")
			.withIndex("by_template_order", (q) =>
				q.eq("templateId", args.templateId),
			)
			.collect();

		// 3. Create new document
		const documentName = args.documentName || `${template.name} - Copy`;
		const documentId = await ctx.db.insert("documents", {
			organizationId,
			ownerId: userId,
			name: documentName,
			description: template.description,
			fileSize: template.fileSize,
			fileType: template.fileType,
			pageCount: template.pageCount,
			thumbnailDataUrl: template.thumbnailDataUrl,
			storageId: template.storageId, // Share the same PDF storage
			sharingMode: "private",
			status: "active",
			workflowStatus: "draft",
			createdAt: now,
			updatedAt: now,
		});

		// 4. Increment template use count
		await ctx.db.patch(args.templateId, {
			useCount: template.useCount + 1,
			updatedAt: now,
		});

		// Note: Signature fields will need to be assigned to recipients after
		// the document is created and recipients are added
		// Return the template fields so the UI can pre-populate the field setup

		return {
			documentId,
			templateFields: templateFields.map((f) => ({
				fieldType: f.fieldType,
				label: f.label,
				isRequired: f.isRequired,
				x: f.x,
				y: f.y,
				width: f.width,
				height: f.height,
				page: f.page,
				properties: f.properties,
				order: f.order,
			})),
		};
	},
});

/**
 * Update template metadata
 * Requires templates:edit permission
 */
export const updateTemplate = permissionMutation("templates:edit")({
	args: {
		templateId: v.id("templates"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;

		const template = await ctx.db.get(args.templateId);
		if (!template || template.status === "deleted") {
			throw new ConvexError("Template not found");
		}

		if (template.organizationId !== organizationId) {
			throw new ConvexError("Template not found");
		}

		const updates: { name?: string; description?: string; updatedAt: number } =
			{
				updatedAt: Date.now(),
			};

		if (args.name !== undefined) {
			updates.name = args.name;
		}
		if (args.description !== undefined) {
			updates.description = args.description;
		}

		await ctx.db.patch(args.templateId, updates);

		return { success: true };
	},
});

/**
 * Delete a template (soft delete)
 * Requires templates:delete permission
 */
export const deleteTemplate = permissionMutation("templates:delete")({
	args: {
		templateId: v.id("templates"),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;

		const template = await ctx.db.get(args.templateId);
		if (!template || template.status === "deleted") {
			throw new ConvexError("Template not found");
		}

		if (template.organizationId !== organizationId) {
			throw new ConvexError("Template not found");
		}

		await ctx.db.patch(args.templateId, {
			status: "deleted",
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Archive a template
 * Requires templates:edit permission
 */
export const archiveTemplate = permissionMutation("templates:edit")({
	args: {
		templateId: v.id("templates"),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;

		const template = await ctx.db.get(args.templateId);
		if (!template || template.status === "deleted") {
			throw new ConvexError("Template not found");
		}

		if (template.organizationId !== organizationId) {
			throw new ConvexError("Template not found");
		}

		await ctx.db.patch(args.templateId, {
			status: "archived",
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Restore an archived template
 * Requires templates:edit permission
 */
export const restoreTemplate = permissionMutation("templates:edit")({
	args: {
		templateId: v.id("templates"),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;

		const template = await ctx.db.get(args.templateId);
		if (!template || template.status === "deleted") {
			throw new ConvexError("Template not found");
		}

		if (template.organizationId !== organizationId) {
			throw new ConvexError("Template not found");
		}

		if (template.status !== "archived") {
			throw new ConvexError("Template is not archived");
		}

		await ctx.db.patch(args.templateId, {
			status: "active",
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Internal mutation to increment template use count
 */
export const incrementUseCount = internalMutation({
	args: {
		templateId: v.id("templates"),
	},
	handler: async (ctx, args) => {
		const template = await ctx.db.get(args.templateId);
		if (!template) return;

		await ctx.db.patch(args.templateId, {
			useCount: template.useCount + 1,
			updatedAt: Date.now(),
		});
	},
});
