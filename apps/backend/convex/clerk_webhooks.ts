/**
 * Webhook functions for syncing Clerk events to Convex
 * These functions are called by webhook handlers and don't require authentication
 */

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import type { OrganizationRole } from "./schema";

/**
 * Sync user from Clerk webhook
 */
export const syncUser = mutation({
	args: {
		clerkId: v.string(),
		name: v.optional(v.string()),
		email: v.string(),
		avatar: v.optional(v.string()),
		isEmailVerified: v.boolean(),
		timezone: v.optional(v.string()),
		locale: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if user already exists
		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		const userData = {
			clerkId: args.clerkId,
			name: args.name || undefined,
			email: args.email,
			avatar: args.avatar || undefined,
			isEmailVerified: args.isEmailVerified,
			lastLoginAt: Date.now(),
			timezone: args.timezone || "UTC",
			locale: args.locale || "en-US",
			updatedAt: Date.now(),
		};

		if (existingUser) {
			// Update existing user
			await ctx.db.patch(existingUser._id, userData);
			return { userId: existingUser._id, isNewUser: false };
		} else {
			// Create new user
			// Note: Organization creation is handled by ensureMyMembership mutation
			// which runs automatically when user first accesses the app
			const userId = await ctx.db.insert("users", userData);

			// Send welcome email to new user
			await ctx.scheduler.runAfter(
				0,
				internal.emails.user_email_actions.sendWelcomeEmail,
				{
					userEmail: args.email,
					userName: args.name,
				},
			);

			return { userId, isNewUser: true };
		}
	},
});

/**
 * Delete user from Clerk webhook
 */
export const deleteUser = mutation({
	args: {
		clerkId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		if (!user) {
			// User doesn't exist, which is fine for deletion
			// This can happen if the user was never synced or already deleted
			console.log(
				`[deleteUser] User with clerkId ${args.clerkId} not found (already deleted or never synced)`,
			);
			return { success: true };
		}

		// Get all memberships for this user
		const memberships = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		// Remove user from all organizations
		for (const membership of memberships) {
			await ctx.db.delete(membership._id);
		}

		// Delete the user
		await ctx.db.delete(user._id);

		return { success: true };
	},
});

/**
 * Sync organization from Clerk webhook
 */
export const syncOrganization = mutation({
	args: {
		clerkId: v.string(),
		name: v.string(),
		slug: v.optional(v.string()),
		logo: v.optional(v.string()),
		metadata: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if organization already exists by Clerk ID first
		let existingOrg = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		// If not found by Clerk ID, check by slug (for backwards compatibility)
		if (!existingOrg) {
			existingOrg = await ctx.db
				.query("organizations")
				.withIndex("by_slug", (q) =>
					q.eq(
						"slug",
						args.slug || args.name.toLowerCase().replace(/\s+/g, "-"),
					),
				)
				.first();
		}

		const organizationData = {
			name: args.name,
			slug: args.slug || args.name.toLowerCase().replace(/\s+/g, "-"),
			type: "company" as const, // Default to company type for Clerk organizations
			logo: args.logo || undefined,
			metadata: args.metadata || undefined,
			currency: "BRL", // Default currency
			currencyKind: "normal" as const,
			timezone: "UTC", // Default timezone
			isActive: true,
			clerkId: args.clerkId,
			updatedAt: Date.now(),
		};

		if (existingOrg) {
			// Update existing organization
			await ctx.db.patch(existingOrg._id, organizationData);
			return { organizationId: existingOrg._id };
		} else {
			// Create new organization
			const organizationId = await ctx.db.insert(
				"organizations",
				organizationData,
			);
			return { organizationId };
		}
	},
});

/**
 * Delete organization from Clerk webhook
 */
export const deleteOrganization = mutation({
	args: {
		clerkId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		if (!organization) {
			// Organization doesn't exist, which is fine for deletion
			// This can happen if the organization was never synced or already deleted
			console.log(
				`[deleteOrganization] Organization with clerkId ${args.clerkId} not found (already deleted or never synced)`,
			);
			return { success: true };
		}

		const members = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organization._id),
			)
			.collect();

		for (const member of members) {
			await ctx.db.delete(member._id);
		}

		// Delete organization
		await ctx.db.delete(organization._id);

		return { success: true };
	},
});

/**
 * Sync organization membership from Clerk webhook
 */
export const syncOrganizationMembership = mutation({
	args: {
		userClerkId: v.string(),
		organizationClerkId: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by Clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userClerkId))
			.first();

		if (!user) {
			throw new ConvexError(`User with clerkId ${args.userClerkId} not found`);
		}

		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) =>
				q.eq("clerkId", args.organizationClerkId),
			)
			.first();

		if (!organization) {
			// Organization webhook hasn't been processed yet (webhook ordering issue)
			// This is expected and will be retried by Clerk automatically
			console.log(
				`⚠️ Organization ${args.organizationClerkId} not found yet - webhook will be retried`,
			);
			// Return success to avoid blocking the webhook queue
			// Clerk will retry this webhook later
			return { skipped: true, reason: "Organization not synced yet" };
		}

		// CRITICAL: Never touch personal organizations - they are managed independently
		// Personal orgs don't have clerkId and are created/managed by ensureMyMembership
		if (organization.type === "personal") {
			console.log(
				`⚠️ Ignoring webhook for personal organization ${organization._id} - managed independently`,
			);
			return {
				skipped: true,
				reason: "Personal organizations are not managed by Clerk",
			};
		}

		// Check if membership already exists
		const existingMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", user._id).eq("organizationId", organization._id),
			)
			.first();

		// Check if user has any other memberships (to determine if this is their first org)
		const userMemberships = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		const isFirstOrganization = userMemberships.length === 0;

		// Map Clerk roles to our role system
		// Only for Clerk-managed organizations (company/group types)
		// Personal organizations are handled by ensureMyMembership and never reach here
		const clerkRole = args.role?.toLowerCase() || "";
		let mappedRole: OrganizationRole;

		// Clerk sends "org:admin" for organization creators/owners
		// We should map this to "owner" role since they created the org
		if (clerkRole.includes("admin") || clerkRole === "org:admin") {
			mappedRole = "owner"; // Creator of the organization should be owner
		} else if (clerkRole.includes("member")) {
			mappedRole = "member";
		} else {
			// Safe default for unrecognized roles
			mappedRole = "viewer";
		}

		console.log(
			`✅ Creating membership - User: ${args.userClerkId}, Org: ${args.organizationClerkId}, Role: ${mappedRole} (from Clerk role: ${args.role}), isFirstOrg: ${isFirstOrganization}`,
		);

		const membershipData = {
			organizationId: organization._id,
			userId: user._id,
			role: mappedRole,
			status: "active" as const,
			isPrimary: isFirstOrganization, // First organization becomes primary
			permissions: [],
		};

		if (existingMembership) {
			// Update existing membership
			await ctx.db.patch(existingMembership._id, membershipData);
			return { membershipId: existingMembership._id };
		} else {
			// Create new membership
			const membershipId = await ctx.db.insert(
				"organization_members",
				membershipData,
			);

			// Set as active organization if user doesn't have one
			if (!user.activeOrganizationId) {
				await ctx.db.patch(user._id, {
					activeOrganizationId: organization._id,
					updatedAt: Date.now(),
				});
			}

			return { membershipId };
		}
	},
});

/**
 * Remove organization membership from Clerk webhook
 */
export const removeOrganizationMembership = mutation({
	args: {
		userClerkId: v.string(),
		organizationClerkId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by Clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userClerkId))
			.first();

		if (!user) {
			throw new ConvexError(`User with clerkId ${args.userClerkId} not found`);
		}

		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) =>
				q.eq("clerkId", args.organizationClerkId),
			)
			.first();

		if (!organization) {
			throw new ConvexError(
				`Organization with clerkId ${args.organizationClerkId} not found`,
			);
		}

		// Find and remove the membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", user._id).eq("organizationId", organization._id),
			)
			.first();

		if (!membership) {
			// Membership doesn't exist, which is fine for deletion
			return { success: true };
		}

		// Remove the membership
		await ctx.db.delete(membership._id);

		// If this was the user's active organization, clear it
		if (user.activeOrganizationId === organization._id) {
			await ctx.db.patch(user._id, {
				activeOrganizationId: undefined,
				updatedAt: Date.now(),
			});
		}

		return { success: true };
	},
});

/**
 * Upsert organization membership from Clerk webhook (with retry logic)
 * This is the enhanced version similar to Catapult-Vite's implementation
 */
export const upsertMembershipFromClerk = internalMutation({
	args: {
		clerkUserId: v.string(),
		clerkOrgId: v.string(),
		clerkMembershipId: v.string(),
		role: v.string(),
		retryCount: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		if (!args.clerkUserId || !args.clerkOrgId || !args.clerkMembershipId) {
			throw new ConvexError({
				code: "INVALID_ARGUMENT",
				message:
					"Clerk User ID, Organization ID, and Membership ID are required",
			});
		}

		const retryCount = args.retryCount || 0;
		const maxRetries = 3;

		// Find user
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkUserId))
			.first();

		if (!user) {
			console.warn(
				`⚠️ User with Clerk ID ${args.clerkUserId} not found for membership upsert`,
			);
			return { error: "User not found" };
		}

		// Find organization
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkOrgId))
			.first();

		if (!organization) {
			if (retryCount < maxRetries) {
				console.log(
					`⏳ Organization not found, retrying in 2 seconds (attempt ${retryCount + 1}/${maxRetries})...`,
				);

				// Schedule a retry after 2 seconds
				await ctx.scheduler.runAfter(
					2000,
					internal.clerk_webhooks.upsertMembershipFromClerk,
					{
						...args,
						retryCount: retryCount + 1,
					},
				);

				return { scheduled: true, retryCount: retryCount + 1 };
			}

			console.warn(
				`⚠️ Organization with Clerk ID ${args.clerkOrgId} not found after ${maxRetries} retries`,
			);
			return { error: "Organization not found after retries" };
		}

		// Check if membership exists by Clerk membership ID
		const existingByClerkMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_clerk_membership_id", (q) =>
				q.eq("clerkMembershipId", args.clerkMembershipId),
			)
			.first();

		// Check if membership exists by user-org combination
		const existingByUserOrg = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", user._id).eq("organizationId", organization._id),
			)
			.first();

		// Check if this is the first member of the organization
		const existingMembers = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organization._id),
			)
			.take(1);

		const isFirstMember = existingMembers.length === 0;

		// Map Clerk roles to our role system
		const clerkRole = args.role?.toLowerCase() || "";
		let mappedRole: OrganizationRole;

		if (isFirstMember) {
			// First member is always owner
			mappedRole = "owner";
		} else if (clerkRole.includes("admin") || clerkRole === "org:admin") {
			mappedRole = "admin";
		} else if (clerkRole.includes("member")) {
			mappedRole = "member";
		} else {
			mappedRole = "viewer";
		}

		const membershipData = {
			userId: user._id,
			organizationId: organization._id,
			role: mappedRole,
			status: "active" as const,
			isPrimary: false,
			permissions: [],
			clerkMembershipId: args.clerkMembershipId,
		};

		if (existingByClerkMembership) {
			// Update existing membership (sync fields only, don't override custom settings)
			await ctx.db.patch(existingByClerkMembership._id, {
				clerkMembershipId: args.clerkMembershipId,
			});
			console.log(
				`✅ Synced existing membership with Clerk ID: ${args.clerkMembershipId}`,
			);
			return { created: false, _id: existingByClerkMembership._id };
		}

		if (existingByUserOrg) {
			// Add Clerk ID to existing membership
			await ctx.db.patch(existingByUserOrg._id, {
				clerkMembershipId: args.clerkMembershipId,
			});
			console.log(
				`✅ Updated existing membership, added Clerk ID: ${args.clerkMembershipId}`,
			);
			return { created: false, _id: existingByUserOrg._id };
		}

		// Create new membership
		const membershipId = await ctx.db.insert(
			"organization_members",
			membershipData,
		);

		const membershipType = isFirstMember ? "owner" : mappedRole;
		console.log(
			`✅ Created membership from Clerk: ${user.email} -> ${organization.name} (${membershipType})`,
		);
		return { created: true, _id: membershipId, isFirstMember };
	},
});

/**
 * Sync membership from Clerk webhook (update only)
 */
export const syncMembershipFromClerk = internalMutation({
	args: {
		clerkMembershipId: v.string(),
	},
	handler: async (ctx, args) => {
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_clerk_membership_id", (q) =>
				q.eq("clerkMembershipId", args.clerkMembershipId),
			)
			.first();

		if (!membership) {
			console.warn(
				`⚠️ Membership with Clerk ID ${args.clerkMembershipId} not found for sync`,
			);
			return { synced: false };
		}

		// Just update the timestamp to show it was synced
		// Don't override role or other custom settings
		console.log(
			`✅ Synced membership with Clerk ID: ${args.clerkMembershipId}`,
		);
		return { synced: true, _id: membership._id };
	},
});

export const deleteMembershipFromClerk = internalMutation({
	args: {
		clerkMembershipId: v.string(),
	},
	handler: async (ctx, args) => {
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_clerk_membership_id", (q) =>
				q.eq("clerkMembershipId", args.clerkMembershipId),
			)
			.first();

		if (!membership) {
			console.warn(
				`⚠️ Membership with Clerk ID ${args.clerkMembershipId} not found for deletion`,
			);
			return { deleted: false };
		}

		const { userId, organizationId } = membership;

		await ctx.db.delete(membership._id);

		await ctx.scheduler.runAfter(
			0,
			internal.documents.sharing_cleanup.fullMemberRemovalCleanup,
			{
				userId,
				organizationId,
			},
		);

		console.log(
			`✅ Deleted membership with Clerk ID: ${args.clerkMembershipId}`,
		);
		return { deleted: true, _id: membership._id };
	},
});

/**
 * Handle organizationInvitation.created webhook
 * Stores the invitation in our database
 */
export const handleInvitationCreated = internalMutation({
	args: {
		clerkInvitationId: v.string(),
		clerkOrganizationId: v.string(),
		emailAddress: v.string(),
		role: v.optional(v.string()),
		publicMetadata: v.optional(v.any()),
		createdAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) =>
				q.eq("clerkId", args.clerkOrganizationId),
			)
			.first();

		if (!organization) {
			console.warn(
				`⚠️ Organization with Clerk ID ${args.clerkOrganizationId} not found for invitation`,
			);
			return { created: false };
		}

		// Extract role from metadata
		const metadata = args.publicMetadata as Record<string, unknown> | undefined;
		const invitationRole = (metadata?.role as string) || "member";

		// Map to our role system
		let role: OrganizationRole;
		if (invitationRole === "admin") {
			role = "admin";
		} else if (invitationRole === "viewer") {
			role = "viewer";
		} else {
			role = "member";
		}

		// Check if invitation already exists
		const existingInvitation = await ctx.db
			.query("organization_invitations")
			.withIndex("by_clerk_invitation_id", (q) =>
				q.eq("clerkInvitationId", args.clerkInvitationId),
			)
			.first();

		if (existingInvitation) {
			console.log(
				`ℹ️ Invitation ${args.clerkInvitationId} already exists, skipping`,
			);
			return { created: false, _id: existingInvitation._id };
		}

		// Get the inviter (first owner/admin of the organization)
		const inviter = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organization._id),
			)
			.filter((q) =>
				q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
			)
			.first();

		if (!inviter) {
			console.warn(
				`⚠️ No owner/admin found for organization ${organization._id}`,
			);
			return { created: false };
		}

		// Get inviter user info for email
		const inviterUser = await ctx.db.get(inviter.userId);

		// Team invitations expire in 7 days
		const INVITATION_EXPIRATION_DAYS = 7;
		const expirationMs = INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
		const expiresAt = args.createdAt
			? args.createdAt + expirationMs
			: Date.now() + expirationMs;

		// Create invitation record
		const invitationId = await ctx.db.insert("organization_invitations", {
			organizationId: organization._id,
			email: args.emailAddress.toLowerCase(),
			role,
			status: "pending",
			token: args.clerkInvitationId, // Use Clerk ID as token
			invitedBy: inviter.userId,
			expiresAt,
			createdAt: args.createdAt || Date.now(),
			clerkInvitationId: args.clerkInvitationId,
			clerkOrganizationId: args.clerkOrganizationId,
		});

		// Send team invitation email
		if (inviterUser) {
			await ctx.scheduler.runAfter(
				0,
				internal.emails.user_email_actions.sendTeamInvitationEmail,
				{
					inviteeEmail: args.emailAddress.toLowerCase(),
					inviterName: inviterUser.name || inviterUser.email || "Team Admin",
					inviterEmail: inviterUser.email,
					organizationName: organization.name,
					role: role.charAt(0).toUpperCase() + role.slice(1), // Capitalize role
					clerkInvitationId: args.clerkInvitationId,
					expiresAt,
				},
			);
		}

		console.log(
			`✅ Created invitation record: ${args.emailAddress} -> ${organization.name}`,
		);
		return { created: true, _id: invitationId };
	},
});

/**
 * Handle organizationInvitation.accepted webhook
 * Creates organization membership when user accepts invitation
 */
export const handleInvitationAccepted = internalMutation({
	args: {
		clerkInvitationId: v.string(),
		clerkOrganizationId: v.string(),
		clerkUserId: v.optional(v.string()),
		retryCount: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const retryCount = args.retryCount || 0;
		const maxRetries = 3;

		// Find the invitation
		const invitation = await ctx.db
			.query("organization_invitations")
			.withIndex("by_clerk_invitation_id", (q) =>
				q.eq("clerkInvitationId", args.clerkInvitationId),
			)
			.first();

		if (!invitation) {
			console.warn(
				`⚠️ Invitation ${args.clerkInvitationId} not found in database`,
			);
			return { accepted: false };
		}

		// Find user by Clerk ID (if provided)
		let user = null;
		if (args.clerkUserId) {
			const clerkUserId = args.clerkUserId;
			user = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
				.first();
		}

		// If user not found by Clerk ID, try by email
		if (!user) {
			user = await ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", invitation.email))
				.first();
		}

		if (!user) {
			if (retryCount < maxRetries) {
				console.log(
					`⏳ User not found, retrying in 2 seconds (attempt ${retryCount + 1}/${maxRetries})...`,
				);

				// Schedule a retry after 2 seconds
				await ctx.scheduler.runAfter(
					2000,
					internal.clerk_webhooks.handleInvitationAccepted,
					{
						...args,
						retryCount: retryCount + 1,
					},
				);

				return { scheduled: true, retryCount: retryCount + 1 };
			}

			console.warn(
				`⚠️ User not found after ${maxRetries} retries for invitation ${args.clerkInvitationId}`,
			);
			return { accepted: false };
		}

		// Check if membership already exists
		const existingMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q
					.eq("userId", user._id)
					.eq("organizationId", invitation.organizationId),
			)
			.first();

		if (existingMembership) {
			console.log(
				`ℹ️ Membership already exists for user ${user.email}, updating invitation status`,
			);

			// Set as active organization if user doesn't have one
			if (!user.activeOrganizationId) {
				await ctx.db.patch(user._id, {
					activeOrganizationId: invitation.organizationId,
					updatedAt: Date.now(),
				});
			}

			// Update invitation status
			await ctx.db.patch(invitation._id, {
				status: "accepted",
				acceptedBy: user._id,
				acceptedAt: Date.now(),
			});

			return { accepted: true, _id: existingMembership._id };
		}

		// Create membership
		const membershipId = await ctx.db.insert("organization_members", {
			organizationId: invitation.organizationId,
			userId: user._id,
			role: invitation.role,
			status: "active",
			isPrimary: false,
			permissions: [],
		});

		// Set as active organization if user doesn't have one
		if (!user.activeOrganizationId) {
			await ctx.db.patch(user._id, {
				activeOrganizationId: invitation.organizationId,
				updatedAt: Date.now(),
			});
		}

		// Update invitation status
		await ctx.db.patch(invitation._id, {
			status: "accepted",
			acceptedBy: user._id,
			acceptedAt: Date.now(),
		});

		console.log(
			`✅ Created membership from invitation: ${user.email} -> organization ${invitation.organizationId}`,
		);
		return { accepted: true, _id: membershipId };
	},
});

/**
 * Handle organizationInvitation.revoked webhook
 * Removes the invitation from our database
 */
export const handleInvitationRevoked = internalMutation({
	args: {
		clerkInvitationId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find and delete the invitation
		const invitation = await ctx.db
			.query("organization_invitations")
			.withIndex("by_clerk_invitation_id", (q) =>
				q.eq("clerkInvitationId", args.clerkInvitationId),
			)
			.first();

		if (!invitation) {
			console.warn(
				`⚠️ Invitation ${args.clerkInvitationId} not found for revocation`,
			);
			return { revoked: false };
		}

		await ctx.db.delete(invitation._id);

		console.log(`✅ Revoked invitation: ${args.clerkInvitationId}`);
		return { revoked: true, _id: invitation._id };
	},
});
