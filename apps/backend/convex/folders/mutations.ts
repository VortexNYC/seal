import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseWriter } from "../_generated/server";
import { adminMutation } from "../auth";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const MAX_FOLDER_DEPTH = 10;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Walk ancestor chain and return depth. Throws if depth exceeds max. */
async function getAncestorDepth(
  db: DatabaseWriter,
  parentId: Id<"folders"> | undefined,
  maxDepth: number
): Promise<number> {
  let current = parentId;
  let depth = 0;
  while (current) {
    depth++;
    if (depth > maxDepth) {
      throw new ConvexError(`Folder nesting cannot exceed ${maxDepth} levels`);
    }
    const parent = await db.get("folders", current);
    if (!parent) break;
    current = parent.parentId;
  }
  return depth;
}

/** Walk ancestor chain to detect circular reference. */
async function detectCircularReference(
  db: DatabaseWriter,
  folderId: Id<"folders">,
  newParentId: Id<"folders"> | undefined
): Promise<void> {
  if (!newParentId) return; // Moving to root is always safe
  let current: Id<"folders"> | undefined = newParentId;
  let depth = 0;
  while (current && depth < MAX_FOLDER_DEPTH * 2) {
    if (current === folderId) {
      throw new ConvexError("Cannot move a folder into its own descendant");
    }
    const parent: Doc<"folders"> | null = await db.get("folders", current);
    if (!parent) break;
    current = parent.parentId;
    depth++;
  }
}

/** Get the maximum depth of a folder's subtree. */
async function getSubtreeDepth(
  db: DatabaseWriter,
  folderId: Id<"folders">
): Promise<number> {
  const children: Doc<"folders">[] = [];
  for await (const child of db
    .query("folders")
    .withIndex("by_parent", (q) => q.eq("parentId", folderId))) {
    children.push(child);
  }
  if (children.length === 0) return 0;
  let max = 0;
  for (const child of children) {
    const d = await getSubtreeDepth(db, child._id);
    if (d + 1 > max) max = d + 1;
  }
  return max;
}

// ── Mutations ────────────────────────────────────────────────────────────

export const createFolder = adminMutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    type: v.union(v.literal("document"), v.literal("template")),
    visibility: v.optional(v.union(v.literal("everyone"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Folder name cannot be empty");

    // Validate parent folder if provided
    if (args.parentId) {
      const parent = await ctx.db.get("folders", args.parentId);
      if (!parent || parent.organizationId !== ctx.auth.organization._id) {
        throw new ConvexError("Parent folder not found");
      }
      if (parent.type !== args.type) {
        throw new ConvexError("Parent folder type must match");
      }
    }

    // Check nesting depth (max 10, -1 to account for the new folder itself)
    await getAncestorDepth(ctx.db, args.parentId, MAX_FOLDER_DEPTH - 1);

    const folderId = await ctx.db.insert("folders", {
      organizationId: ctx.auth.organization._id,
      name,
      parentId: args.parentId,
      type: args.type,
      visibility: args.visibility ?? "everyone",
      createdBy: ctx.auth.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id: folderId };
  },
});

export const updateFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("everyone"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get("folders", args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    const updates: Partial<{
      name: string;
      visibility: "everyone" | "admin";
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("Folder name cannot be empty");
      updates.name = name;
    }
    if (args.visibility !== undefined) {
      updates.visibility = args.visibility;
    }

    await ctx.db.patch("folders", args.folderId, updates);
    return { success: true };
  },
});

export const deleteFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get("folders", args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    // Collect all descendant folder IDs (BFS)
    const toDelete: Id<"folders">[] = [args.folderId];
    const queue: Id<"folders">[] = [args.folderId];

    while (queue.length > 0) {
      const currentId = sealAssertPresent(queue.shift());
      for await (const child of ctx.db
        .query("folders")
        .withIndex("by_parent", (q) => q.eq("parentId", currentId))) {
        toDelete.push(child._id);
        queue.push(child._id);
      }
    }

    // Orphan documents and templates in all deleted folders (move to root),
    // then delete all folders. Convex mutations are transactional — all or nothing.
    for (const fId of toDelete) {
      for await (const doc of ctx.db
        .query("documents")
        .withIndex("by_folder", (q) => q.eq("folderId", fId))) {
        await ctx.db.patch("documents", doc._id, { folderId: undefined });
      }

      for await (const tmpl of ctx.db
        .query("templates")
        .withIndex("by_folder", (q) => q.eq("folderId", fId))) {
        await ctx.db.patch("templates", tmpl._id, { folderId: undefined });
      }
    }

    for (const fId of toDelete) {
      await ctx.db.delete("folders", fId);
    }

    return { success: true };
  },
});

export const moveToFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
    newParentId: v.optional(v.id("folders")), // undefined = move to root
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get("folders", args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    // Validate new parent
    if (args.newParentId) {
      const newParent = await ctx.db.get("folders", args.newParentId);
      if (
        !newParent ||
        newParent.organizationId !== ctx.auth.organization._id
      ) {
        throw new ConvexError("Target folder not found");
      }
      if (newParent.type !== folder.type) {
        throw new ConvexError("Cannot move folder to a different type");
      }
    }

    // Prevent circular reference
    await detectCircularReference(ctx.db, args.folderId, args.newParentId);

    // Check depth won't exceed max after move
    const newDepth = args.newParentId
      ? (await getAncestorDepth(ctx.db, args.newParentId, MAX_FOLDER_DEPTH)) + 1
      : 0;

    const subtreeDepth = await getSubtreeDepth(ctx.db, args.folderId);
    if (newDepth + subtreeDepth + 1 > MAX_FOLDER_DEPTH) {
      throw new ConvexError(
        `Move would exceed maximum nesting depth of ${MAX_FOLDER_DEPTH}`
      );
    }

    await ctx.db.patch("folders", args.folderId, {
      parentId: args.newParentId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const moveItemsToFolder = adminMutation({
  args: {
    itemIds: v.array(v.union(v.id("documents"), v.id("templates"))),
    itemType: v.union(v.literal("document"), v.literal("template")),
    targetFolderId: v.optional(v.id("folders")), // undefined = move to root
  },
  handler: async (ctx, args) => {
    const orgId = ctx.auth.organization._id;

    // Validate target folder if provided
    if (args.targetFolderId) {
      const targetFolder = await ctx.db.get("folders", args.targetFolderId);
      if (!targetFolder || targetFolder.organizationId !== orgId) {
        throw new ConvexError("Target folder not found");
      }
      if (targetFolder.type !== args.itemType) {
        throw new ConvexError(
          `Cannot move ${args.itemType}s into a ${targetFolder.type} folder`
        );
      }
    }

    let moved = 0;
    for (const itemId of args.itemIds) {
      if (args.itemType === "document") {
        const documentId = ctx.db.normalizeId("documents", itemId);
        if (!documentId) continue;
        const item = await ctx.db.get("documents", documentId);
        if (!item || item.organizationId !== orgId) continue;
        await ctx.db.patch("documents", documentId, {
          folderId: args.targetFolderId,
        });
        moved++;
      } else {
        const templateId = ctx.db.normalizeId("templates", itemId);
        if (!templateId) continue;
        const item = await ctx.db.get("templates", templateId);
        if (!item || item.organizationId !== orgId) continue;
        await ctx.db.patch("templates", templateId, {
          folderId: args.targetFolderId,
        });
        moved++;
      }
    }

    return { success: true, moved };
  },
});

export const togglePinFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get("folders", args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    const pinned = !folder.pinned;
    await ctx.db.patch("folders", args.folderId, {
      pinned,
      updatedAt: Date.now(),
    });

    return { pinned };
  },
});
