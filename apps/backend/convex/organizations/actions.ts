/**
 * Organization Actions - Clerk Backend API Integration
 *
 * These actions use the Clerk Backend API to manage organization invitations.
 * Invitations are sent via Clerk's email system and synced via webhooks.
 */

import { createClerkClient } from "@clerk/backend";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";

/**
 * Send organization invitation via Clerk backend API
 * Creates an invitation in Clerk which automatically sends an email
 * The webhook will sync the invitation to our database
 */
export const clerkInvite = action({
	args: {
		email: v.string(),
		role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
		// Get the authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError("Authentication required");
		}

		// Check if Clerk is configured
		if (!process.env.CLERK_SECRET_KEY) {
			throw new ConvexError({
				code: "MISSING_CONFIG",
				message: "CLERK_SECRET_KEY environment variable is not set",
			});
		}

		// Get organization via internal query
		const organization = await ctx.runQuery(
			internal.organizations.helpers.getOrganizationById,
			{
				organizationId: args.organizationId,
			},
		);

		if (!organization) {
			throw new ConvexError("Organization not found");
		}

		if (!organization.clerkId) {
			throw new ConvexError({
				code: "ORGANIZATION_NOT_SYNCED",
				message:
					"This organization is not synced with Clerk. Only Clerk-managed organizations can send invitations.",
			});
		}

		try {
			const clerk = createClerkClient({
				secretKey: process.env.CLERK_SECRET_KEY,
			});

			// Create invitation in Clerk
			// Note: We're using "org:member" as the Clerk role - the actual role is stored in publicMetadata
			await clerk.organizations.createOrganizationInvitation({
				organizationId: organization.clerkId,
				emailAddress: args.email.toLowerCase(),
				role: "org:member",
				publicMetadata: {
					role: args.role, // Store our role in metadata
				},
			});

			return { ok: true, message: "Invitation sent successfully" };
		} catch (error) {
			console.error("[clerkInvite] Error:", error);
			throw new ConvexError({
				code: "INVITATION_ERROR",
				message:
					error instanceof Error ? error.message : "Failed to send invitation",
			});
		}
	},
});

/**
 * Revoke an organization invitation via Clerk backend API
 * Prevents the user from accepting the invitation
 * Clerk will send a webhook event to update our database
 */
export const clerkRevokeInvitation = action({
	args: {
		clerkInvitationId: v.string(),
		clerkOrganizationId: v.string(),
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

		try {
			const clerk = createClerkClient({
				secretKey: process.env.CLERK_SECRET_KEY,
			});

			// Revoke the invitation in Clerk
			await clerk.organizations.revokeOrganizationInvitation({
				invitationId: args.clerkInvitationId,
				organizationId: args.clerkOrganizationId,
			});

			return { ok: true, message: "Invitation revoked successfully" };
		} catch (error) {
			console.error("[clerkRevokeInvitation] Error:", error);
			throw new ConvexError({
				code: "REVOKE_ERROR",
				message:
					error instanceof Error
						? error.message
						: "Failed to revoke invitation",
			});
		}
	},
});

/**
 * Get invitation email by Clerk invitation ID
 * Used by the accept-invite route to prefill the email in signup
 */
export const getInvitationEmailByClerkId = action({
	args: {
		clerkInvitationId: v.string(),
	},
	handler: async (ctx, args): Promise<{ email: string | null }> => {
		// This is a public action - no auth required
		// The invitation ID itself serves as authentication

		try {
			// Query our database for the invitation
			// The invitation was synced via webhook when it was created
			const invitation = await ctx.runQuery(
				internal.organizations.queries.getInvitationByClerkId,
				{
					clerkInvitationId: args.clerkInvitationId,
				},
			);

			if (!invitation) {
				return { email: null };
			}

			return { email: invitation.emailAddress };
		} catch (error) {
			console.error("[getInvitationEmailByClerkId] Error:", error);
			return { email: null };
		}
	},
});

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
		const member = await ctx.runQuery(
			internal.organizations.helpers.getOrganizationMemberById,
			{
				memberId: args.memberId,
				organizationId: args.organizationId,
			},
		);

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
		const user = await ctx.runQuery(
			internal.organizations.helpers.getUserById,
			{
				userId: member.userId,
			},
		);

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
				message:
					error instanceof Error ? error.message : "Failed to delete user",
			});
		}
	},
});
