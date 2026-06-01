/**
 * Organization Actions - Clerk Backend API Integration
 *
 * Member deletion is performed via the Clerk Backend API. The corresponding
 * user.deleted webhook cleans up the user (and memberships) in Convex.
 */

import { createClerkClient } from "@clerk/backend";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";

/**
 * Delete a user via Clerk backend API
 * This will trigger the user.deleted webhook which will clean up the user in Convex
 */
export const clerkDeleteUser = action({
  args: {
    memberId: v.id("organization_members"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    // Get the authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (!process.env.CLERK_SECRET_KEY) {
      throw new ConvexError({
        code: "MISSING_CONFIG",
        message: "CLERK_SECRET_KEY environment variable is not set",
      });
    }

    // Get the member to delete
    const member = await ctx.runQuery(internal.organizations.helpers.getOrganizationMemberById, {
      memberId: args.memberId,
      organizationId: args.organizationId,
    });

    if (!member) {
      throw new ConvexError("Member not found");
    }

    // Prevent deleting owners
    if (member.role === "owner") {
      throw new ConvexError({
        code: "CANNOT_DELETE_OWNER",
        message: "Cannot delete organization owner",
      });
    }

    // Get the user to find their Clerk ID
    const user = await ctx.runQuery(internal.organizations.helpers.getUserById, {
      userId: member.userId,
    });

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (!user.clerkId) {
      throw new ConvexError({
        code: "USER_NOT_SYNCED",
        message: "This user is not synced with Clerk",
      });
    }

    try {
      const clerk = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      // Delete the user in Clerk
      // This will trigger the user.deleted webhook which will clean up:
      // - User record in Convex
      // - All organization memberships
      await clerk.users.deleteUser(user.clerkId);

      return { ok: true, message: "User deleted successfully" };
    } catch (error) {
      console.error("[clerkDeleteUser] Error:", error);
      throw new ConvexError({
        code: "DELETE_ERROR",
        message: error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  },
});
