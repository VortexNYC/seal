/**
 * @fileoverview Team member management for the public API.
 * Lists workspace members and retrieves individual member details.
 *
 * @module api/v1/members
 * @requires seal:members:read scope
 */
import { v } from "convex/values";

import { internalQuery } from "../../_generated/server";
import {
  getComponentMemberById,
  listComponentMembersByOrganization,
} from "../../lib/componentOrgReads";

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

/**
 * Internal query to list all workspace members.
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
  },
  handler: async (ctx, args): Promise<ApiMember[]> => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return [];
    }
    const members = await listComponentMembersByOrganization(ctx, organization);

    const roleOrder: Record<string, number> = {
      owner: 0,
      admin: 1,
      member: 2,
      viewer: 3,
      system: 4,
    };

    const results: ApiMember[] = [];
    for (const member of members) {
      // Skip system members from public API
      if (member.role === "system") continue;
      // Filter by role if requested
      if (args.role && member.role !== args.role) continue;

      if (!member.userId) continue;
      const user = await ctx.db.get(member.userId);
      if (!user) continue;

      results.push({
        id: member.memberId,
        user_id: user._id,
        name: user.name ?? user.email,
        email: user.email,
        avatar_url: user.avatar ?? undefined,
        role: member.role as ApiMember["role"],
        status: member.status,
        joined_at: new Date(member.createdAt).toISOString(),
      });
    }

    return results.sort((a, b) => {
      const roleCompare = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      if (roleCompare !== 0) return roleCompare;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
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
    memberId: v.string(),
  },
  handler: async (ctx, args): Promise<ApiMember | null> => {
    const member = await getComponentMemberById(ctx, args.memberId);
    if (
      !member ||
      member.organizationId !== args.organizationId ||
      !member.userId ||
      !member.role
    ) {
      return null;
    }

    const user = await ctx.db.get(member.userId);
    if (!user) return null;

    return {
      id: member.memberId,
      user_id: user._id,
      name: user.name ?? user.email,
      email: user.email,
      avatar_url: user.avatar ?? undefined,
      role: member.role as ApiMember["role"],
      status: member.status,
      joined_at: new Date(member.createdAt).toISOString(),
    };
  },
});
