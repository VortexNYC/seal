/**
 * @fileoverview Team member management for the public API.
 * Lists workspace members and retrieves individual member details.
 *
 * @module api/v1/members
 * @requires seal:members:read scope
 */
import { v } from "convex/values";

import { internalQuery } from "../../_generated/server";

/** API representation of a workspace member */
export interface ApiMember {
  /** Membership record ID */
  id: string;
  /** Internal user ID */
  user_id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Avatar URL */
  avatar_url?: string;
  /** Role in the workspace */
  role: "owner" | "admin" | "member" | "viewer";
  /** Membership status */
  status: string;
  /** ISO 8601 timestamp when member joined */
  joined_at: string;
}

/** Sortable member fields */
type MemberSortField = "role" | "name" | "joined_at" | "email";
/** Sort direction */
type SortOrder = "asc" | "desc";

const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
  system: 4,
};

function matchesSearch(displayName: string, email: string, searchTerm: string): boolean {
  return displayName.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm);
}

function compareMembers(a: ApiMember, b: ApiMember, sortBy: MemberSortField, direction: 1 | -1): number {
  let cmp = 0;
  switch (sortBy) {
    case "role":
      cmp = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
      break;
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "joined_at":
      cmp = new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      break;
    case "email":
      cmp = a.email.localeCompare(b.email);
      break;
  }
  if (cmp !== 0) return cmp * direction;
  return (new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()) * direction;
}

function slicePage(results: ApiMember[], cursor: string | undefined, limit: number): {
  paged: ApiMember[];
  hasMore: boolean;
  nextCursor?: string;
} {
  let start = 0;
  if (cursor) {
    const idx = results.findIndex((m) => m.id === cursor);
    if (idx !== -1) start = idx + 1;
  }
  const page = results.slice(start, start + limit + 1);
  const hasMore = page.length > limit;
  const paged = hasMore ? page.slice(0, limit) : page;
  const nextCursor = hasMore ? paged[paged.length - 1]?.id : undefined;
  return { paged, hasMore, nextCursor };
}

/**
 * Internal query to list workspace members with pagination, filtering, and sorting.
 *
 * @internal
 */
export const listMembers = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    role: v.optional(
      v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer")),
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    sort_by: v.optional(v.union(v.literal("role"), v.literal("name"), v.literal("joined_at"), v.literal("email"))),
    sort_order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    members: ApiMember[];
    hasMore: boolean;
    nextCursor?: string;
  }> => {
    const limit = Math.min(args.limit ?? 20, 100);
    const sortBy: MemberSortField = args.sort_by ?? "role";
    const sortOrder: SortOrder = args.sort_order ?? "asc";
    const searchTerm = args.search?.trim().toLowerCase();

    const members = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const results: ApiMember[] = [];
    for (const member of members) {
      if (member.role === "system") continue;
      if (args.role && member.role !== args.role) continue;
      if (args.status && member.status !== args.status) continue;

      const user = await ctx.db.get(member.userId);
      if (!user) continue;

      const displayName = user.name ?? user.email;
      if (searchTerm && !matchesSearch(displayName, user.email, searchTerm)) continue;

      results.push({
        id: member._id,
        user_id: user._id,
        name: displayName,
        email: user.email,
        avatar_url: user.avatar ?? undefined,
        role: member.role as ApiMember["role"],
        status: member.status,
        joined_at: new Date(member._creationTime).toISOString(),
      });
    }

    const direction = sortOrder === "desc" ? -1 : 1;
    results.sort((a, b) => compareMembers(a, b, sortBy, direction as 1 | -1));

    const { paged, hasMore, nextCursor } = slicePage(results, args.cursor, limit);
    return { members: paged, hasMore, nextCursor };
  },
});

/**
 * Internal query to get a single workspace member by membership ID.
 *
 * @internal
 */
export const getMember = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    memberId: v.id("organization_members"),
  },
  handler: async (ctx, args): Promise<ApiMember | null> => {
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== args.organizationId) return null;

    const user = await ctx.db.get(member.userId);
    if (!user) return null;

    return {
      id: member._id,
      user_id: user._id,
      name: user.name ?? user.email,
      email: user.email,
      avatar_url: user.avatar ?? undefined,
      role: member.role as ApiMember["role"],
      status: member.status,
      joined_at: new Date(member._creationTime).toISOString(),
    };
  },
});
