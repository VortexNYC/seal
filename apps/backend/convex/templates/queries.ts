/**
 * Template queries
 *
 * SEA-80/82: Document Templates - Query functions
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { permissionQuery } from "../auth";

/**
 * Get all templates for an organization
 * Requires templates:read permission
 */
export const getOrganizationTemplates = permissionQuery("templates:read")({
  args: {
    folderId: v.optional(v.id("folders")),
    rootOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const templates = await ctx.db
      .query("templates")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active")
      )
      .order("desc")
      .collect();

    // Filter by folder
    const folderFiltered =
      args.folderId !== undefined
        ? templates.filter((t) => t.folderId === args.folderId)
        : args.rootOnly
          ? templates.filter((t) => t.folderId === undefined)
          : templates;

    return folderFiltered;
  },
});

/**
 * Get a single template by ID
 * Requires templates:read permission
 */
export const getTemplate = permissionQuery("templates:read")({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const template = await ctx.db.get(args.templateId);

    if (!template || template.status === "deleted") {
      throw new ConvexError("Template not found");
    }

    // Verify the template belongs to the user's organization
    if (template.organizationId !== organizationId) {
      throw new ConvexError("Template not found");
    }

    return template;
  },
});

/**
 * Get template fields
 * Requires templates:read permission
 */
export const getTemplateFields = permissionQuery("templates:read")({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    // Verify template access
    const template = await ctx.db.get(args.templateId);
    if (
      !template ||
      template.status === "deleted" ||
      template.organizationId !== organizationId
    ) {
      throw new ConvexError("Template not found");
    }

    const fields = await ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) =>
        q.eq("templateId", args.templateId)
      )
      .collect();

    return fields;
  },
});

/**
 * Get template with fields (combined for convenience)
 * Requires templates:read permission
 */
export const getTemplateWithFields = permissionQuery("templates:read")({
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

    const fields = await ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) =>
        q.eq("templateId", args.templateId)
      )
      .collect();

    return {
      ...template,
      fields,
    };
  },
});

/**
 * Internal query to get template by ID (no auth check)
 */
export const getTemplateInternal = internalQuery({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args): Promise<Doc<"templates"> | null> => {
    return await ctx.db.get(args.templateId);
  },
});

/**
 * Internal query to get template fields (no auth check)
 */
export const getTemplateFieldsInternal = internalQuery({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args): Promise<Doc<"template_fields">[]> => {
    return await ctx.db
      .query("template_fields")
      .withIndex("by_template_order", (q) =>
        q.eq("templateId", args.templateId)
      )
      .collect();
  },
});

/**
 * Search templates by name
 * Requires templates:read permission
 */
export const searchTemplates = permissionQuery("templates:read")({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const templates = await ctx.db
      .query("templates")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active")
      )
      .collect();

    // Simple case-insensitive search
    const searchTerm = args.query.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm) ||
        t.description?.toLowerCase().includes(searchTerm)
    );
  },
});
