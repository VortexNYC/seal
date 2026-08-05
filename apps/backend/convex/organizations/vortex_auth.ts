/**
 * Core Vortex Auth member surface adapters.
 *
 * FunctionReference shapes for `@vortexnyc/auth/react`
 * VortexOrganizationMembersSurface — replace Seal-local team dialogs.
 */

import { ConvexError, v } from "convex/values";

import { api, components } from "../_generated/api";
import { action } from "../_generated/server";
import { logAction } from "../audit_logs/helpers";
import { adminMutation, authQuery } from "../auth";
import { ensureSeatLimit } from "../auth/subscription_guards";
import {
  getComponentMemberById,
  listComponentMembersByOrganization,
} from "../lib/componentOrgReads";
import { ensureComponentRoleForTemplate } from "../lib/vortexAuthOrganizations";

const roleTemplateValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer")
);

type SurfaceRole = "owner" | "admin" | "member" | "viewer";

function normalizeRoleTemplate(role: string): SurfaceRole {
  if (
    role === "owner" ||
    role === "admin" ||
    role === "member" ||
    role === "viewer"
  ) {
    return role;
  }
  return "member";
}

function mapStatus(
  status: string
): "active" | "pending" | "inactive" | "suspended" {
  if (status === "active") return "active";
  if (status === "pending" || status === "invited") return "pending";
  if (status === "inactive") return "inactive";
  return "suspended";
}

/** Active-org member list for VortexOrganizationMembersSurface. */
export const listMembers = authQuery({
  args: {},
  handler: async (ctx) => {
    const members = await listComponentMembersByOrganization(
      ctx,
      ctx.auth.organization
    );

    const items = [];
    for (const member of members) {
      if (!member.userId) {
        continue;
      }
      const user = await ctx.db.get(member.userId);
      items.push({
        _id: member.memberId,
        roleTemplate: normalizeRoleTemplate(member.role),
        status: mapStatus(member.status),
        createdAt: member.createdAt,
        updatedAt: member.updatedAt ?? member.createdAt,
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
            }
          : null,
      });
    }
    return items;
  },
});

/**
 * Invite via Core surface. `organizationId` is the vortex-auth component org id.
 */
export const inviteMember = action({
  args: {
    email: v.string(),
    organizationId: v.string(),
    roleTemplate: roleTemplateValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    acceptUrl: string;
    invitationId: string;
    token: string;
  }> => {
    const role = args.roleTemplate;
    if (role === "owner") {
      throw new ConvexError("Cannot invite as owner");
    }

    return await ctx.runMutation(api.invitations.createInvitation, {
      email: args.email,
      role,
      expectedVortexAuthOrganizationId: args.organizationId,
    });
  },
});

export const setMemberRole = adminMutation({
  args: {
    membershipId: v.string(),
    roleTemplate: roleTemplateValidator,
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;
    if (!organization.vortexAuthOrganizationId) {
      throw new ConvexError("Organization is not anchored to Vortex Auth");
    }

    const membership = await getComponentMemberById(ctx, args.membershipId);
    if (
      !membership ||
      membership.organizationId !== organization._id ||
      !membership.userId
    ) {
      throw new ConvexError("Member not found");
    }
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot change your own role");
    }
    if (membership.role === "owner" && ctx.auth.member.role !== "owner") {
      throw new ConvexError("Only owners can change owner roles");
    }
    if (args.roleTemplate === "owner" && ctx.auth.member.role !== "owner") {
      throw new ConvexError("Only owners can assign owner roles");
    }

    const previousRole = membership.role;
    const roleId = await ensureComponentRoleForTemplate(
      ctx,
      organization._id,
      args.roleTemplate
    );
    await ctx.runMutation(components.vortexAuth.organizations.setMemberRole, {
      memberId: args.membershipId,
      organizationId: organization.vortexAuthOrganizationId,
      roleId,
      assignedBy: currentUser.vortexAuthUserId,
    });

    await logAction(ctx, {
      organizationId: organization._id,
      userId: currentUser.authSubject,
      actorType: "user",
      actorId: currentUser.authSubject,
      action: "member.role_changed",
      resourceType: "member",
      resourceId: membership.userId,
      oldValues: { role: previousRole },
      newValues: { role: args.roleTemplate },
      metadata: {
        description: `Role changed from ${previousRole} to ${args.roleTemplate}`,
      },
      ipAddress: "web-authenticated",
    });

    return { success: true };
  },
});

export const suspendMember = adminMutation({
  args: {
    membershipId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;
    const membership = await getComponentMemberById(ctx, args.membershipId);
    if (
      !membership ||
      membership.organizationId !== organization._id ||
      !membership.userId
    ) {
      throw new ConvexError("Member not found");
    }
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot suspend yourself");
    }
    if (membership.role === "owner") {
      throw new ConvexError("Cannot suspend organization owner");
    }

    await ctx.runMutation(components.vortexAuth.organizations.setMemberStatus, {
      memberId: args.membershipId,
      status: "suspended",
    });
    return { success: true };
  },
});

export const reactivateMember = adminMutation({
  args: {
    membershipId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;
    const membership = await getComponentMemberById(ctx, args.membershipId);
    if (
      !membership ||
      membership.organizationId !== organization._id ||
      !membership.userId
    ) {
      throw new ConvexError("Member not found");
    }

    if (membership.status !== "active") {
      // SEA-605: reactivating into a full seat pool must fail.
      await ensureSeatLimit(ctx, organization._id);
    }

    await ctx.runMutation(components.vortexAuth.organizations.setMemberStatus, {
      memberId: args.membershipId,
      status: "active",
    });
    return { success: true };
  },
});
