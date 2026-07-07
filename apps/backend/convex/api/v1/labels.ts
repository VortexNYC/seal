/**
 * @fileoverview Label management for the public API.
 * CRUD operations for workspace labels.
 *
 * @module api/v1/labels
 * @requires seal:labels:read for GET, seal:labels:write for POST/PUT/DELETE
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

/** API representation of a label */
export interface ApiLabel {
  /** Label record ID */
  id: string;
  /** Label name */
  name: string;
  /** Hex color code */
  color?: string;
  /** Optional description */
  description?: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * Internal query to list labels in the workspace.
 *
 * @internal
 */
export const listLabels = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ labels: ApiLabel[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);

    const raw = await ctx.db
      .query("labels")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Client-side search filter
    const filtered = args.search
      ? raw.filter((l) => l.name.toLowerCase().includes(args.search!.toLowerCase()))
      : raw;

    // Cursor pagination
    let start = 0;
    if (args.cursor) {
      const idx = filtered.findIndex((l) => l._id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = filtered.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?._id : undefined;

    return {
      labels: items.map((l) => ({
        id: l._id,
        name: l.name,
        color: l.color,
        description: l.description,
        created_at: new Date(l.createdAt).toISOString(),
        updated_at: new Date(l.updatedAt).toISOString(),
      })),
      has_more,
      next_cursor,
    };
  },
});

/**
 * Internal query to get a single label by ID.
 *
 * @internal
 */
export const getLabel = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args): Promise<ApiLabel | null> => {
    const l = await ctx.db.get(args.labelId);
    if (!l || l.organizationId !== args.organizationId) return null;

    return {
      id: l._id,
      name: l.name,
      color: l.color,
      description: l.description,
      created_at: new Date(l.createdAt).toISOString(),
      updated_at: new Date(l.updatedAt).toISOString(),
    };
  },
});

/**
 * Internal mutation to create a new label.
 *
 * @internal
 */
export const createLabel = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    name: v.string(),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ id: string }> => {
    const now = Date.now();

    const labelId = await ctx.db.insert("labels", {
      organizationId: args.organizationId,
      name: args.name,
      color: args.color,
      description: args.description,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    return { id: labelId };
  },
});

/**
 * Internal mutation to update a label.
 *
 * @internal
 */
export const updateLabel = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    labelId: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const label = await ctx.db.get(args.labelId);
    if (!label || label.organizationId !== args.organizationId) {
      return { success: false, error: "Label not found" };
    }

    const updateData: {
      name?: string;
      color?: string;
      description?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updateData.name = args.name;
    }
    if (args.color !== undefined) {
      updateData.color = args.color;
    }
    if (args.description !== undefined) {
      updateData.description = args.description;
    }

    await ctx.db.patch(args.labelId, updateData);

    return { success: true };
  },
});

/**
 * Internal mutation to delete a label.
 *
 * @internal
 */
export const deleteLabel = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const label = await ctx.db.get(args.labelId);
    if (!label || label.organizationId !== args.organizationId) {
      throw new Error("Label not found");
    }

    await ctx.db.delete(args.labelId);
    return { success: true };
  },
});
