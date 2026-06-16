import { ConvexError, v } from "convex/values";

import { authQuery } from "../auth";
import { AuthUtils } from "../auth.utils";
import { resolveComponentMembershipForOrganization } from "../lib/componentOrgReads";

export const listFolders = authQuery({
  args: {
    organizationId: v.id("organizations"),
    parentId: v.optional(v.id("folders")), // undefined = root
    type: v.union(v.literal("document"), v.literal("template")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new ConvexError("Organization not found");
    const member = await resolveComponentMembershipForOrganization(
      ctx,
      ctx.auth.user,
      organization,
    );

    if (!member) throw new ConvexError("No access to this organization");

    const isAdminOrOwner = AuthUtils.isAdminOrOwner(member);

    // Query folders by parent
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", args.organizationId).eq("type", args.type),
      )
      .collect();

    // Filter by parentId (in-memory since Convex can't do optional index prefix + filter)
    const filtered = allFolders.filter((f) => {
      // Match parentId (undefined for root)
      if (args.parentId ? f.parentId !== args.parentId : f.parentId !== undefined) {
        return false;
      }
      // Visibility: everyone sees "everyone" folders, only admin/owner sees "admin" folders
      // Exception: creator always sees their own folders
      if (f.visibility === "admin" && !isAdminOrOwner && f.createdBy !== userId) {
        return false;
      }
      return true;
    });

    // Sort: pinned first, then alphabetical
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getFolderBreadcrumbs = authQuery({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let current = await ctx.db.get(args.folderId);
    let depth = 0;

    while (current && depth < 10) {
      breadcrumbs.unshift({ id: current._id, name: current.name });
      if (!current.parentId) break;
      current = await ctx.db.get(current.parentId);
      depth++;
    }

    return breadcrumbs;
  },
});

export const getFolder = authQuery({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new ConvexError("Folder not found");
    return folder;
  },
});

/**
 * Get all folders for an org+type as a flat list.
 * Used by the "Move to folder" picker dialog to show a tree.
 */
export const getAllFoldersFlat = authQuery({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(v.literal("document"), v.literal("template")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new ConvexError("Organization not found");
    const member = await resolveComponentMembershipForOrganization(
      ctx,
      ctx.auth.user,
      organization,
    );

    if (!member) throw new ConvexError("No access to this organization");
    const isAdminOrOwner = AuthUtils.isAdminOrOwner(member);

    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", args.organizationId).eq("type", args.type),
      )
      .collect();

    return allFolders
      .filter((f) => {
        if (f.visibility === "admin" && !isAdminOrOwner && f.createdBy !== userId) {
          return false;
        }
        return true;
      })
      .map((f) => ({
        _id: f._id,
        name: f.name,
        parentId: f.parentId,
        pinned: f.pinned,
      }));
  },
});
