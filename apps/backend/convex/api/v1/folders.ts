/**
 * @fileoverview Folder management for the public API.
 * CRUD operations for organizing documents and templates into folders.
 *
 * @module api/v1/folders
 * @requires seal:folders:read for GET, seal:folders:write for POST/PUT/DELETE
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

/** API representation of a folder */
export interface ApiFolder {
  /** Folder record ID */
  id: string;
  /** Folder name */
  name: string;
  /** Parent folder ID (null for root folders) */
  parent_id?: string;
  /** Folder type */
  type: "document" | "template";
  /** Visibility setting */
  visibility: "everyone" | "admin";
  /** Whether the folder is pinned */
  pinned?: boolean;
  /** User ID who created this folder */
  created_by: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
}

function mapFolderToApi(folder: {
  _id: string;
  name: string;
  parentId?: string;
  type: "document" | "template";
  visibility: "everyone" | "admin";
  pinned?: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}): ApiFolder {
  return {
    id: folder._id,
    name: folder.name,
    parent_id: folder.parentId,
    type: folder.type,
    visibility: folder.visibility,
    pinned: folder.pinned,
    created_by: folder.createdBy,
    created_at: new Date(folder.createdAt).toISOString(),
    updated_at: new Date(folder.updatedAt).toISOString(),
  };
}

/**
 * Internal query to list folders in the workspace.
 *
 * @internal
 */
export const listFolders = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    type: v.optional(v.union(v.literal("document"), v.literal("template"))),
    parentId: v.optional(v.id("folders")),
    search: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ folders: ApiFolder[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);

    let raw;
    if (args.type && args.parentId) {
      raw = await ctx.db
        .query("folders")
        .withIndex("by_org_type", (q) =>
          q.eq("organizationId", args.organizationId).eq("type", args.type!),
        )
        .filter((q) => q.eq(q.field("parentId"), args.parentId!))
        .collect();
    } else if (args.type) {
      raw = await ctx.db
        .query("folders")
        .withIndex("by_org_type", (q) =>
          q.eq("organizationId", args.organizationId).eq("type", args.type!),
        )
        .collect();
    } else {
      raw = await ctx.db
        .query("folders")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect();
    }

    // Client-side search filter
    const filtered = args.search
      ? raw.filter((f) => f.name.toLowerCase().includes(args.search!.toLowerCase()))
      : raw;

    // Cursor pagination
    let start = 0;
    if (args.cursor) {
      const idx = filtered.findIndex((f) => f._id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = filtered.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?._id : undefined;

    return {
      folders: items.map(mapFolderToApi),
      has_more,
      next_cursor,
    };
  },
});

/**
 * Internal query to get a single folder by ID.
 *
 * @internal
 */
export const getFolder = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    folderId: v.id("folders"),
  },
  handler: async (ctx, args): Promise<ApiFolder | null> => {
    const doc = await ctx.db.get(args.folderId);
    if (!doc || doc.organizationId !== args.organizationId) return null;
    return mapFolderToApi(doc);
  },
});

/**
 * Internal mutation to create a new folder.
 *
 * @internal
 */
export const createFolder = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    name: v.string(),
    type: v.union(v.literal("document"), v.literal("template")),
    parent_id: v.optional(v.id("folders")),
    visibility: v.optional(v.union(v.literal("everyone"), v.literal("admin"))),
  },
  handler: async (ctx, args): Promise<{ id: string }> => {
    // If parentId is provided, verify it belongs to the same org
    if (args.parent_id) {
      const parent = await ctx.db.get(args.parent_id);
      if (!parent || parent.organizationId !== args.organizationId) {
        throw new Error("Parent folder not found");
      }
    }

    const now = Date.now();
    const folderId = await ctx.db.insert("folders", {
      organizationId: args.organizationId,
      name: args.name,
      type: args.type,
      parentId: args.parent_id,
      visibility: args.visibility ?? "everyone",
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    return { id: folderId };
  },
});

/**
 * Internal mutation to update an existing folder.
 *
 * @internal
 */
export const updateFolder = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    parent_id: v.optional(v.id("folders")),
    visibility: v.optional(v.union(v.literal("everyone"), v.literal("admin"))),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.organizationId !== args.organizationId) {
      return { success: false, error: "Folder not found" };
    }

    // Prevent self-referencing parent
    if (args.parent_id === args.folderId) {
      return { success: false, error: "A folder cannot be its own parent" };
    }

    // If parentId is provided, verify it belongs to the same org
    if (args.parent_id) {
      const parent = await ctx.db.get(args.parent_id);
      if (!parent || parent.organizationId !== args.organizationId) {
        return { success: false, error: "Parent folder not found" };
      }
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.parent_id !== undefined) patch.parentId = args.parent_id;
    if (args.visibility !== undefined) patch.visibility = args.visibility;
    if (args.pinned !== undefined) patch.pinned = args.pinned;

    await ctx.db.patch(args.folderId, patch);
    return { success: true };
  },
});

/**
 * Internal mutation to delete a folder.
 *
 * @internal
 */
export const deleteFolder = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    folderId: v.id("folders"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.organizationId !== args.organizationId) {
      throw new Error("Folder not found");
    }

    await ctx.db.delete(args.folderId);
    return { success: true };
  },
});
