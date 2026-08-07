/**
 * Template mutations
 *
 * SEA-80/81/83: Document Templates - Mutation functions
 */

import { parse } from "@vortexnyc/convex/helpers";
import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { permissionMutation } from "../auth";
import { ensureProFeature } from "../auth/subscription_guards";
import { fieldTypeTuple } from "../schemas/signature_fields";

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
    await ensureProFeature(ctx.db, organizationId, "Templates");

    // 1. Get the source document
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // Verify document belongs to the user's organization
    if (document.organizationId !== organizationId) {
      throw new ConvexError("Document not found");
    }

    // 2. Get all signature fields for this document
    const fields: Doc<"signature_fields">[] = [];
    for await (const field of ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      fields.push(field);
    }

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

    // 0. Templates require Pro plan
    await ensureProFeature(ctx.db, organizationId, "Templates");

    // 1. Get the template
    const template = await ctx.db.get("templates", args.templateId);
    if (!template || template.status === "deleted") {
      throw new ConvexError("Template not found");
    }

    // Verify template belongs to the user's organization
    if (template.organizationId !== organizationId) {
      throw new ConvexError("Template not found");
    }

    // 2. Get template fields
    const templateFields: Doc<"template_fields">[] = [];
    for await (const field of ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) =>
        q.eq("templateId", args.templateId)
      )) {
      templateFields.push(field);
    }

    // 3. Create new document with template reference
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
      storageId: template.storageId,
      sourceTemplateId: args.templateId,
      sharingMode: "private",
      status: "active",
      workflowStatus: "draft",
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create unassigned signature fields from template fields
    for (const tf of templateFields) {
      await ctx.db.insert("signature_fields", {
        documentId,
        recipientId: undefined,
        templateFieldId: tf._id,
        fieldType: parse(fieldTypeTuple, tf.fieldType),
        label: tf.label ?? "",
        isRequired: tf.isRequired,
        x: tf.x,
        y: tf.y,
        width: tf.width,
        height: tf.height,
        page: tf.page,
        properties: tf.properties,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 5. Increment template use count
    await ctx.db.patch("templates", args.templateId, {
      useCount: template.useCount + 1,
      updatedAt: now,
    });

    return {
      documentId,
      fieldCount: templateFields.length,
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

    const template = await ctx.db.get("templates", args.templateId);
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

    await ctx.db.patch("templates", args.templateId, updates);

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

    const template = await ctx.db.get("templates", args.templateId);
    if (!template || template.status === "deleted") {
      throw new ConvexError("Template not found");
    }

    if (template.organizationId !== organizationId) {
      throw new ConvexError("Template not found");
    }

    await ctx.db.patch("templates", args.templateId, {
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

    const template = await ctx.db.get("templates", args.templateId);
    if (!template || template.status === "deleted") {
      throw new ConvexError("Template not found");
    }

    if (template.organizationId !== organizationId) {
      throw new ConvexError("Template not found");
    }

    await ctx.db.patch("templates", args.templateId, {
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

    const template = await ctx.db.get("templates", args.templateId);
    if (!template || template.status === "deleted") {
      throw new ConvexError("Template not found");
    }

    if (template.organizationId !== organizationId) {
      throw new ConvexError("Template not found");
    }

    if (template.status !== "archived") {
      throw new ConvexError("Template is not archived");
    }

    await ctx.db.patch("templates", args.templateId, {
      status: "active",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Template Field CRUD
// ─────────────────────────────────────────────────────────────────────────────

const templateFieldPropertiesValidator = v.optional(
  v.object({
    options: v.optional(v.array(v.string())),
    placeholder: v.optional(v.string()),
    defaultValue: v.optional(v.string()),
  })
);

/**
 * Add a new field to a template
 * Requires templates:edit permission
 */
export const addTemplateField = permissionMutation("templates:edit")({
  args: {
    templateId: v.id("templates"),
    fieldType: v.string(),
    label: v.optional(v.string()),
    isRequired: v.boolean(),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    page: v.number(),
    properties: templateFieldPropertiesValidator,
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const now = Date.now();

    const template = await ctx.db.get("templates", args.templateId);
    if (!template || template.status === "deleted") {
      throw new ConvexError("Template not found");
    }
    if (template.organizationId !== organizationId) {
      throw new ConvexError("Template not found");
    }

    // Determine next order value
    const existingFields: Doc<"template_fields">[] = [];
    for await (const field of ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) =>
        q.eq("templateId", args.templateId)
      )) {
      existingFields.push(field);
    }
    const nextOrder =
      existingFields.length > 0
        ? Math.max(...existingFields.map((f) => f.order)) + 1
        : 0;

    const fieldId = await ctx.db.insert("template_fields", {
      templateId: args.templateId,
      fieldType: args.fieldType,
      label: args.label,
      isRequired: args.isRequired,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      page: args.page,
      properties: args.properties,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    });

    // Touch template timestamp
    await ctx.db.patch("templates", args.templateId, { updatedAt: now });

    return fieldId;
  },
});

/**
 * Update a template field's properties
 * Requires templates:edit permission
 */
export const updateTemplateField = permissionMutation("templates:edit")({
  args: {
    fieldId: v.id("template_fields"),
    label: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    properties: templateFieldPropertiesValidator,
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const now = Date.now();

    const field = await ctx.db.get("template_fields", args.fieldId);
    if (!field) {
      throw new ConvexError("Template field not found");
    }

    const template = await ctx.db.get("templates", field.templateId);
    if (
      !template ||
      template.status === "deleted" ||
      template.organizationId !== organizationId
    ) {
      throw new ConvexError("Template not found");
    }

    await ctx.db.patch("template_fields", args.fieldId, {
      ...(args.label !== undefined && { label: args.label }),
      ...(args.isRequired !== undefined && { isRequired: args.isRequired }),
      ...(args.properties !== undefined && { properties: args.properties }),
      updatedAt: now,
    });

    await ctx.db.patch("templates", field.templateId, { updatedAt: now });

    return { success: true };
  },
});

/**
 * Reposition a template field (move or resize)
 * Requires templates:edit permission
 */
export const repositionTemplateField = permissionMutation("templates:edit")({
  args: {
    fieldId: v.id("template_fields"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const now = Date.now();

    const field = await ctx.db.get("template_fields", args.fieldId);
    if (!field) {
      throw new ConvexError("Template field not found");
    }

    const template = await ctx.db.get("templates", field.templateId);
    if (
      !template ||
      template.status === "deleted" ||
      template.organizationId !== organizationId
    ) {
      throw new ConvexError("Template not found");
    }

    await ctx.db.patch("template_fields", args.fieldId, {
      ...(args.x !== undefined && { x: args.x }),
      ...(args.y !== undefined && { y: args.y }),
      ...(args.width !== undefined && { width: args.width }),
      ...(args.height !== undefined && { height: args.height }),
      ...(args.page !== undefined && { page: args.page }),
      updatedAt: now,
    });

    await ctx.db.patch("templates", field.templateId, { updatedAt: now });

    return { success: true };
  },
});

/**
 * Delete a template field
 * Requires templates:edit permission
 */
export const deleteTemplateField = permissionMutation("templates:edit")({
  args: {
    fieldId: v.id("template_fields"),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const now = Date.now();

    const field = await ctx.db.get("template_fields", args.fieldId);
    if (!field) {
      throw new ConvexError("Template field not found");
    }

    const template = await ctx.db.get("templates", field.templateId);
    if (
      !template ||
      template.status === "deleted" ||
      template.organizationId !== organizationId
    ) {
      throw new ConvexError("Template not found");
    }

    await ctx.db.delete("template_fields", args.fieldId);
    await ctx.db.patch("templates", field.templateId, { updatedAt: now });

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
    const template = await ctx.db.get("templates", args.templateId);
    if (!template) return;

    await ctx.db.patch("templates", args.templateId, {
      useCount: template.useCount + 1,
      updatedAt: Date.now(),
    });
  },
});
