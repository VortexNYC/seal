/**
 * Document sharing management for Seal
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { authQuery, permissionMutation } from "../auth";

/**
 * Update sharing mode for a document
 * Only the owner or users with "manage" permission can change sharing mode
 * Requires documents:share permission
 */
export const updateSharingMode = permissionMutation("documents:share")({
	args: {
		documentId: v.id("documents"),
		sharingMode: v.union(
			v.literal("private"),
			v.literal("workspace"),
			v.literal("specific"),
		),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check if user can manage this document (owner or has "manage" permission)
		let canManage = document.ownerId === userId;
		if (!canManage) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", document._id).eq("userId", userId),
				)
				.first();
			canManage =
				access?.permissionLevel === "manage" && access.revokedAt === undefined;
		}

		if (!canManage) {
			throw new ConvexError(
				"Only the document owner or managers can change sharing settings",
			);
		}

		// 3. Check plan restrictions for team sharing
		if (args.sharingMode === "workspace" || args.sharingMode === "specific") {
			const subscription = await ctx.db
				.query("subscriptions")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.first();

			const isPro = subscription?.status === "active";

			if (!isPro) {
				throw new ConvexError(
					"Team sharing features require a Pro plan. Please upgrade to share documents with your team.",
				);
			}
		}

		// 4. Update sharing mode
		await ctx.db.patch(args.documentId, {
			sharingMode: args.sharingMode,
			updatedAt: Date.now(),
		});

		// 5. If changing from "specific" to another mode, optionally clean up access records
		// (We'll keep them for audit trail, but mark as inactive if needed)

		return { success: true };
	},
});

/**
 * Grant access to a specific user
 * Only works when document is in "specific" sharing mode
 * Requires documents:share permission
 */
export const grantAccess = permissionMutation("documents:share")({
	args: {
		documentId: v.id("documents"),
		userId: v.id("users"),
		permissionLevel: v.union(
			v.literal("view"),
			v.literal("edit"),
			v.literal("manage"),
		),
	},
	handler: async (ctx, args) => {
		const currentUserId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check if current user can manage this document
		let canManage = document.ownerId === currentUserId;
		if (!canManage) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", document._id).eq("userId", currentUserId),
				)
				.first();
			canManage =
				access?.permissionLevel === "manage" && access.revokedAt === undefined;
		}

		if (!canManage) {
			throw new ConvexError(
				"Only the document owner or managers can grant access",
			);
		}

		// 3. Ensure document is in "specific" sharing mode
		if (document.sharingMode !== "specific") {
			throw new ConvexError(
				'Document must be in "specific" sharing mode to grant individual access',
			);
		}

		// 4. Verify target user is a member of the organization
		const targetMember = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q
					.eq("userId", args.userId)
					.eq("organizationId", document.organizationId),
			)
			.first();

		if (!targetMember || targetMember.status !== "active") {
			throw new ConvexError(
				"User is not an active member of this organization",
			);
		}

		// 5. Check if access already exists
		const existingAccess = await ctx.db
			.query("document_access")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.first();

		if (existingAccess) {
			// Update existing access if it was revoked or permission level changed
			await ctx.db.patch(existingAccess._id, {
				permissionLevel: args.permissionLevel,
				grantedBy: currentUserId,
				grantedAt: Date.now(),
				revokedAt: undefined, // Clear any previous revocation
			});
		} else {
			// Create new access record
			await ctx.db.insert("document_access", {
				documentId: args.documentId,
				userId: args.userId,
				permissionLevel: args.permissionLevel,
				grantedBy: currentUserId,
				grantedAt: Date.now(),
			});
		}

		// Schedule email notification to the recipient
		await ctx.scheduler.runAfter(
			0,
			internal.documents.document_shared_action.sendDocumentSharedEmail,
			{
				documentId: args.documentId,
				recipientUserId: args.userId,
				sharedByUserId: currentUserId,
				permissionLevel: args.permissionLevel,
			},
		);

		return { success: true };
	},
});

/**
 * Revoke access from a specific user
 * Requires documents:share permission
 */
export const revokeAccess = permissionMutation("documents:share")({
	args: {
		documentId: v.id("documents"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const currentUserId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check if current user can manage this document
		let canManage = document.ownerId === currentUserId;
		if (!canManage) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", document._id).eq("userId", currentUserId),
				)
				.first();
			canManage =
				access?.permissionLevel === "manage" && access.revokedAt === undefined;
		}

		if (!canManage) {
			throw new ConvexError(
				"Only the document owner or managers can revoke access",
			);
		}

		// 3. Cannot revoke access from owner
		if (args.userId === document.ownerId) {
			throw new ConvexError("Cannot revoke access from document owner");
		}

		// 4. Find and mark access as revoked
		const access = await ctx.db
			.query("document_access")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.first();

		if (!access) {
			throw new ConvexError(
				"User does not have explicit access to this document",
			);
		}

		// Mark as revoked (soft delete for audit trail)
		await ctx.db.patch(access._id, {
			revokedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Update permission level for a user who already has access
 * Requires documents:share permission
 */
export const updateAccessLevel = permissionMutation("documents:share")({
	args: {
		documentId: v.id("documents"),
		userId: v.id("users"),
		newPermissionLevel: v.union(
			v.literal("view"),
			v.literal("edit"),
			v.literal("manage"),
		),
	},
	handler: async (ctx, args) => {
		const currentUserId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Check if current user can manage this document
		let canManage = document.ownerId === currentUserId;
		if (!canManage) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", document._id).eq("userId", currentUserId),
				)
				.first();
			canManage =
				access?.permissionLevel === "manage" && access.revokedAt === undefined;
		}

		if (!canManage) {
			throw new ConvexError(
				"Only the document owner or managers can update access levels",
			);
		}

		// 3. Find the access record
		const access = await ctx.db
			.query("document_access")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.first();

		if (!access || access.revokedAt !== undefined) {
			throw new ConvexError(
				"User does not have active access to this document",
			);
		}

		// 4. Update permission level
		await ctx.db.patch(access._id, {
			permissionLevel: args.newPermissionLevel,
			grantedBy: currentUserId,
			grantedAt: Date.now(), // Update grant timestamp
		});

		return { success: true };
	},
});

/**
 * Transfer document ownership to another user in the organization
 * Requires documents:share permission (owner-level operation)
 */
export const transferOwnership = permissionMutation("documents:share")({
	args: {
		documentId: v.id("documents"),
		newOwnerId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const currentUserId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Only current owner can transfer ownership
		if (document.ownerId !== currentUserId) {
			throw new ConvexError("Only the document owner can transfer ownership");
		}

		// 3. Verify new owner is a member of the organization
		const newOwnerMember = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q
					.eq("userId", args.newOwnerId)
					.eq("organizationId", document.organizationId),
			)
			.first();

		if (!newOwnerMember || newOwnerMember.status !== "active") {
			throw new ConvexError(
				"New owner must be an active member of this organization",
			);
		}

		// 4. Transfer ownership
		await ctx.db.patch(args.documentId, {
			ownerId: args.newOwnerId,
			updatedAt: Date.now(),
		});

		// 5. Optionally: Grant the previous owner "manage" access
		// This ensures they don't lose all access to the document
		await ctx.db.insert("document_access", {
			documentId: args.documentId,
			userId: currentUserId,
			permissionLevel: "manage",
			grantedBy: args.newOwnerId, // New owner granted this
			grantedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Get document access list for sharing dialog
 * Returns all users who have been granted access to a document
 */
export const getDocumentAccess = authQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			return null;
		}

		// 2. Check if user can view this document (owner, has access, or workspace-shared)
		let canView = document.ownerId === userId;

		if (!canView && document.sharingMode === "workspace") {
			// Check if user is in the same organization
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();
			canView = member !== null && member.status === "active";
		}

		if (!canView) {
			// Check direct access
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", args.documentId).eq("userId", userId),
				)
				.first();
			canView = access !== null && access.revokedAt === undefined;
		}

		if (!canView) {
			return null;
		}

		// 3. Get all active access records
		const accessRecords = await ctx.db
			.query("document_access")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const activeAccessRecords = accessRecords.filter(
			(a) => a.revokedAt === undefined,
		);

		// 4. Get owner info
		const owner = await ctx.db.get(document.ownerId);

		// 5. Get user details for each access record
		const accessWithUsers = await Promise.all(
			activeAccessRecords.map(async (access) => {
				const user = await ctx.db.get(access.userId);
				const grantedByUser = await ctx.db.get(access.grantedBy);
				return {
					_id: access._id,
					userId: access.userId,
					userName: user?.name ?? null,
					userEmail: user?.email ?? "Unknown",
					permissionLevel: access.permissionLevel,
					grantedAt: access.grantedAt,
					grantedBy: grantedByUser?.name ?? "Unknown",
				};
			}),
		);

		return {
			documentId: args.documentId,
			documentName: document.name,
			sharingMode: document.sharingMode,
			owner: {
				userId: document.ownerId,
				name: owner?.name ?? null,
				email: owner?.email ?? "Unknown",
			},
			sharedWith: accessWithUsers,
		};
	},
});

/**
 * Get organization members for sharing UI
 * Returns members who can be granted access to a document
 */
export const getShareableMembers = authQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			return [];
		}

		// 2. Check if user can manage this document
		let canManage = document.ownerId === userId;
		if (!canManage) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", args.documentId).eq("userId", userId),
				)
				.first();
			canManage =
				access?.permissionLevel === "manage" && access.revokedAt === undefined;
		}

		if (!canManage) {
			return [];
		}

		// 3. Get all organization members
		const members = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", document.organizationId),
			)
			.collect();

		const activeMembers = members.filter((m) => m.status === "active");

		// 4. Get existing access records to mark already-shared members
		const accessRecords = await ctx.db
			.query("document_access")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const activeAccessMap = new Map(
			accessRecords
				.filter((a) => a.revokedAt === undefined)
				.map((a) => [a.userId.toString(), a.permissionLevel]),
		);

		// 5. Get user details for each member
		const shareableMembers = await Promise.all(
			activeMembers.map(async (member) => {
				const user = await ctx.db.get(member.userId);
				const isOwner = member.userId === document.ownerId;
				const existingAccess = activeAccessMap.get(member.userId.toString());

				return {
					userId: member.userId,
					name: user?.name ?? null,
					email: user?.email ?? "Unknown",
					role: member.role,
					isOwner,
					hasAccess: isOwner || existingAccess !== undefined,
					permissionLevel: isOwner ? ("owner" as const) : existingAccess,
				};
			}),
		);

		// Sort: owner first, then by name
		return shareableMembers.sort((a, b) => {
			if (a.isOwner) return -1;
			if (b.isOwner) return 1;
			return (a.name ?? a.email).localeCompare(b.name ?? b.email);
		});
	},
});
