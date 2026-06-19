/**
 * @fileoverview Templates REST API internal queries and handlers.
 * Provides operations for reusable document templates via the public API.
 *
 * @module api/v1/templates
 * @requires seal:templates:read scope for GET operations
 * @requires seal:templates:write scope for POST/PUT/DELETE operations
 */

import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";
import { clampPaginationLimit } from "../middleware";

/**
 * API template response format.
 */
export interface ApiTemplate {
  /** Unique template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Optional description */
  description?: string;
  /** Template status */
  status: "active" | "archived";
  /** Number of documents created from this template */
  use_count: number;
  /** Page count of the PDF */
  page_count?: number;
  /** Number of fields defined in this template */
  field_count: number;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * API template field response format.
 */
export interface ApiTemplateField {
  /** Unique field identifier */
  id: string;
  /** Field type */
  type: string;
  /** Optional label */
  label?: string;
  /** Whether the field is required */
  is_required: boolean;
  /** X position (percentage) */
  x: number;
  /** Y position (percentage) */
  y: number;
  /** Width (percentage) */
  width: number;
  /** Height (percentage) */
  height: number;
  /** Page number (1-indexed) */
  page: number;
  /** Field order for sequential assignment */
  order: number;
  /** Field-specific properties */
  properties?: {
    options?: string[];
    placeholder?: string;
    default_value?: string;
  };
}

/**
 * Internal query to list templates for API.
 *
 * @internal
 */
export const listTemplates = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    templates: ApiTemplate[];
    hasMore: boolean;
    nextCursor?: string;
  }> => {
    const limit = clampPaginationLimit(args.limit);

    let query = ctx.db.query("templates").withIndex("by_organization_status", (q) => {
      const base = q.eq("organizationId", args.organizationId);
      if (args.status === "active" || args.status === "archived") {
        return base.eq("status", args.status);
      }
      return base.eq("status", "active");
    });

    // Apply cursor if provided
    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor as never);
      if (cursorDoc) {
        query = query.filter((q) => q.lt(q.field("_creationTime"), cursorDoc._creationTime));
      }
    }

    const templates = await query.order("desc").take(limit + 1);

    const hasMore = templates.length > limit;
    const resultTemplates = hasMore ? templates.slice(0, -1) : templates;

    // Get field counts for each template
    const templatesWithCounts = await Promise.all(
      resultTemplates.map(async (template) => {
        const fields = await ctx.db
          .query("template_fields")
          .withIndex("by_template", (q) => q.eq("templateId", template._id))
          .collect();

        return {
          id: template._id,
          name: template.name,
          description: template.description,
          status: template.status as "active" | "archived",
          use_count: template.useCount,
          page_count: template.pageCount,
          field_count: fields.length,
          created_at: new Date(template.createdAt).toISOString(),
          updated_at: new Date(template.updatedAt).toISOString(),
        };
      }),
    );

    const lastTemplate = resultTemplates[resultTemplates.length - 1];
    const nextCursor = hasMore && lastTemplate ? (lastTemplate._id as string) : undefined;

    return {
      templates: templatesWithCounts,
      hasMore,
      nextCursor,
    };
  },
});

/**
 * Internal query to get a single template.
 *
 * @internal
 */
export const getTemplate = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    templateId: v.id("templates"),
    includeFields: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<(ApiTemplate & { fields?: ApiTemplateField[] }) | null> => {
    const template = await ctx.db.get(args.templateId);

    if (!template || template.status === "deleted") {
      return null;
    }

    if (template.organizationId !== args.organizationId) {
      return null;
    }

    // Get field count
    const fields = await ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) => q.eq("templateId", args.templateId))
      .collect();

    const result: ApiTemplate & { fields?: ApiTemplateField[] } = {
      id: template._id,
      name: template.name,
      description: template.description,
      status: template.status as "active" | "archived",
      use_count: template.useCount,
      page_count: template.pageCount,
      field_count: fields.length,
      created_at: new Date(template.createdAt).toISOString(),
      updated_at: new Date(template.updatedAt).toISOString(),
    };

    if (args.includeFields) {
      result.fields = fields.map((f) => ({
        id: f._id,
        type: f.fieldType,
        label: f.label,
        is_required: f.isRequired,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        page: f.page,
        order: f.order,
        properties: f.properties
          ? {
              options: f.properties.options,
              placeholder: f.properties.placeholder,
              default_value: f.properties.defaultValue,
            }
          : undefined,
      }));
    }

    return result;
  },
});

/**
 * Internal query to get template fields.
 *
 * @internal
 */
export const getTemplateFields = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    templateId: v.id("templates"),
  },
  handler: async (ctx, args): Promise<ApiTemplateField[] | null> => {
    const template = await ctx.db.get(args.templateId);

    if (!template || template.status === "deleted") {
      return null;
    }

    if (template.organizationId !== args.organizationId) {
      return null;
    }

    const fields = await ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) => q.eq("templateId", args.templateId))
      .collect();

    return fields.map((f) => ({
      id: f._id,
      type: f.fieldType,
      label: f.label,
      is_required: f.isRequired,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      page: f.page,
      order: f.order,
      properties: f.properties
        ? {
            options: f.properties.options,
            placeholder: f.properties.placeholder,
            default_value: f.properties.defaultValue,
          }
        : undefined,
    }));
  },
});

/**
 * Internal mutation to create a template from a document via API.
 *
 * @internal
 */
export const createFromDocument = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; templateId?: string; error?: string }> => {
    // Validate name
    if (args.name.trim().length === 0) {
      return { success: false, error: "Name is required" };
    }
    if (args.name.length > 200) {
      return { success: false, error: "Name must be 200 characters or less" };
    }

    // Get source document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return { success: false, error: "Document not found" };
    }

    if (document.organizationId !== args.organizationId) {
      return { success: false, error: "Document not found" };
    }

    // Get signature fields from document
    const fields = await ctx.db
      .query("signature_fields")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const now = Date.now();

    // Create template
    const templateId = await ctx.db.insert("templates", {
      organizationId: args.organizationId,
      createdBy: args.userId,
      name: args.name.trim(),
      description: args.description,
      sourceDocumentId: args.documentId,
      storageId: document.storageId,
      fileSize: document.fileSize,
      fileType: document.fileType,
      pageCount: document.pageCount,
      thumbnailDataUrl: document.thumbnailDataUrl,
      useCount: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Copy fields to template_fields
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

    return { success: true, templateId };
  },
});

/**
 * Internal mutation to update a template via API.
 *
 * @internal
 */
export const updateTemplate = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    templateId: v.id("templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const template = await ctx.db.get(args.templateId);

    if (!template || template.status === "deleted") {
      return { success: false, error: "Template not found" };
    }

    if (template.organizationId !== args.organizationId) {
      return { success: false, error: "Template not found" };
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      if (args.name.trim().length === 0) {
        return { success: false, error: "Name is required" };
      }
      if (args.name.length > 200) {
        return {
          success: false,
          error: "Name must be 200 characters or less",
        };
      }
      updates.name = args.name.trim();
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.status !== undefined) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.templateId, updates);

    return { success: true };
  },
});

/**
 * Internal mutation to delete a template via API.
 *
 * @internal
 */
export const deleteTemplate = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    templateId: v.id("templates"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const template = await ctx.db.get(args.templateId);

    if (!template || template.status === "deleted") {
      return { success: false, error: "Template not found" };
    }

    if (template.organizationId !== args.organizationId) {
      return { success: false, error: "Template not found" };
    }

    // Soft delete
    await ctx.db.patch(args.templateId, {
      status: "deleted",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to create a document from a template via API.
 *
 * @internal
 */
export const useTemplate = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    templateId: v.id("templates"),
    documentName: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    documentId?: string;
    templateFields?: {
      type: string;
      label?: string;
      is_required: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
      order: number;
    }[];
    error?: string;
  }> => {
    const template = await ctx.db.get(args.templateId);

    if (!template || template.status === "deleted") {
      return { success: false, error: "Template not found" };
    }

    if (template.organizationId !== args.organizationId) {
      return { success: false, error: "Template not found" };
    }

    if (template.status === "archived") {
      return { success: false, error: "Cannot use archived template" };
    }

    // Get template fields
    const templateFields = await ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) => q.eq("templateId", args.templateId))
      .collect();

    const now = Date.now();
    const documentName = args.documentName || `${template.name} - Copy`;

    // Create new document
    const documentId = await ctx.db.insert("documents", {
      organizationId: args.organizationId,
      ownerId: args.userId,
      name: documentName,
      description: args.description ?? template.description,
      fileSize: template.fileSize,
      fileType: template.fileType,
      pageCount: template.pageCount,
      thumbnailDataUrl: template.thumbnailDataUrl,
      storageId: template.storageId,
      sharingMode: "private",
      status: "active",
      workflowStatus: "draft",
      createdAt: now,
      updatedAt: now,
    });

    // Increment template use count
    await ctx.db.patch(args.templateId, {
      useCount: template.useCount + 1,
      updatedAt: now,
    });

    return {
      success: true,
      documentId,
      templateFields: templateFields.map((f) => ({
        type: f.fieldType,
        label: f.label,
        is_required: f.isRequired,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        page: f.page,
        order: f.order,
      })),
    };
  },
});
