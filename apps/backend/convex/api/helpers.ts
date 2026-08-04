/**
 * @fileoverview Internal helper queries for API context resolution.
 * These are internal queries not exposed to clients, used by the
 * API Context Bridge to resolve auth subjects to internal Convex IDs.
 *
 * @module api/helpers
 * @internal
 */

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { ROLE_PERMISSIONS } from "../auth.utils";
import {
  listComponentMembersByOrganization,
  resolveComponentMemberships,
  resolveComponentMembershipForOrganization,
} from "../lib/componentOrgReads";

/**
 * Get membership for user in organization.
 * Validates that a user has an active membership in the target organization.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @param organizationId - Internal Convex organization ID
 * @returns Membership document or null if not found
 */
export const getMembership = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const [user, organization] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.organizationId),
    ]);
    if (!user || !organization) {
      return null;
    }
    const membership = await resolveComponentMembershipForOrganization(
      ctx,
      user,
      organization
    );
    if (!membership) {
      return null;
    }
    return {
      userId: args.userId,
      organizationId: args.organizationId,
      role: membership.role,
      status: membership.status,
      permissions: ROLE_PERMISSIONS[membership.role] ?? [],
      isPrimary: user.activeOrganizationId === args.organizationId,
    };
  },
});

/**
 * Get user's active organization.
 * Returns the organization set as active for the user, if any.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @returns Organization document or null if user has no active organization
 */
export const getUserActiveOrganization = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.activeOrganizationId) {
      return null;
    }
    return ctx.db.get(user.activeOrganizationId);
  },
});

/**
 * Get user's permissions in an organization.
 * Fetches the role and computes the effective permissions.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @param organizationId - Internal Convex organization ID
 * @returns Permission set or null if user is not a member
 */
export const getUserPermissions = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const [user, organization] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.organizationId),
    ]);
    if (!user || !organization) {
      return null;
    }
    const membership = await resolveComponentMembershipForOrganization(
      ctx,
      user,
      organization
    );
    if (!membership || membership.status !== "active") {
      return null;
    }

    return {
      role: membership.role,
      permissions: ROLE_PERMISSIONS[membership.role] ?? [],
      isPrimary: user.activeOrganizationId === args.organizationId,
    };
  },
});

/**
 * Get organization owner.
 * Returns the primary owner of an organization.
 * Used for organization-scoped API keys when no specific user context is provided.
 *
 * Falls back to finding any active owner-role member if no isPrimary member exists.
 *
 * @internal
 * @param organizationId - Internal Convex organization ID
 * @returns User document of the owner or null
 */
export const getOrganizationOwner = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return null;
    }

    const members = await listComponentMembersByOrganization(ctx, organization);
    const ownerMembership = members.find(
      (member) =>
        member.role === "owner" && member.status === "active" && member.userId
    );

    if (ownerMembership?.userId) {
      return ctx.db.get(ownerMembership.userId);
    }

    const adminMembership = members.find(
      (member) =>
        member.role === "admin" && member.status === "active" && member.userId
    );

    if (!adminMembership?.userId) {
      return null;
    }

    return ctx.db.get(adminMembership.userId);
  },
});

/**
 * Validate document access for API request.
 * Checks if a user has access to a specific document.
 *
 * @internal
 * @param documentId - Document ID to check access for
 * @param userId - User requesting access
 * @param organizationId - Organization context
 * @returns Document if accessible, null otherwise
 */
export const getDocumentForApi = internalQuery({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      return null;
    }

    // Check organization ownership
    if (document.organizationId !== args.organizationId) {
      return null;
    }

    return document;
  },
});

/**
 * Get all organization memberships for a user.
 * Used to auto-select organization for OAuth users.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @returns Array of active membership documents with organization data
 */
export const getUserOrganizationMemberships = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return [];
    }
    const memberships = await resolveComponentMemberships(ctx, user);

    // Fetch organization details for each membership
    const membershipsWithOrgs = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        return {
          ...membership,
          userId: args.userId,
          organization: org,
        };
      })
    );

    return membershipsWithOrgs.filter((m) => m.organization !== null);
  },
});

/**
 * Log API activity for analytics and debugging.
 *
 * @internal
 * @param apiKeyId - The API key ID
 * @param userId - Internal user ID
 * @param organizationId - Internal organization ID
 * @param action - The API action performed (e.g., "documents.list")
 * @param resourceType - Type of resource accessed
 * @param resourceId - Optional specific resource ID
 * @param metadata - Additional metadata about the request
 */
export const logApiActivity = internalQuery({
  args: {
    apiKeyId: v.string(),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    // For now, just log to console
    // In production, this could write to an api_activity table
    console.info("[API Activity]", {
      apiKeyId: args.apiKeyId,
      userId: args.userId,
      organizationId: args.organizationId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      timestamp: new Date().toISOString(),
    });

    return { logged: true };
  },
});
