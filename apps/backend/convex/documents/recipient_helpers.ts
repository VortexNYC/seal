/**
 * Helper functions for document recipient operations
 */

import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Verify that a user owns a document
 * Throws ConvexError if not the owner
 */
export async function verifyDocumentOwnership(
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	userId: Id<"users">,
): Promise<void> {
	const document = await ctx.db.get(documentId);

	if (!document) {
		throw new ConvexError("Document not found");
	}

	if (document.status === "deleted") {
		throw new ConvexError("Document has been deleted");
	}

	if (document.ownerId !== userId) {
		throw new ConvexError(
			"You don't have permission to perform this action on this document",
		);
	}
}

/**
 * Check if a user has access to a document (owner or has explicit access)
 * Returns the permission level or null if no access
 */
export async function getUserDocumentPermission(
	ctx: QueryCtx,
	documentId: Id<"documents">,
	userId: Id<"users">,
): Promise<"view" | "edit" | "manage" | "owner" | null> {
	const document = await ctx.db.get(documentId);

	if (!document || document.status === "deleted") {
		return null;
	}

	// Owner has full access
	if (document.ownerId === userId) {
		return "owner";
	}

	// Check explicit access grants
	const access = await ctx.db
		.query("document_access")
		.withIndex("by_document_user", (q) =>
			q.eq("documentId", documentId).eq("userId", userId),
		)
		.first();

	if (access && !access.revokedAt) {
		return access.permissionLevel;
	}

	// Check workspace sharing
	if (document.sharingMode === "workspace") {
		// User needs to be a member of the same organization
		const userMember = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", userId).eq("organizationId", document.organizationId),
			)
			.first();

		if (userMember && userMember.status === "active") {
			return "view"; // Workspace sharing grants view access
		}
	}

	return null;
}

/**
 * Verify user has at least the specified permission level
 */
export async function verifyDocumentPermission(
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	userId: Id<"users">,
	requiredLevel: "view" | "edit" | "manage",
): Promise<void> {
	const permission = await getUserDocumentPermission(ctx, documentId, userId);

	if (!permission) {
		throw new ConvexError("You don't have access to this document");
	}

	// Permission hierarchy: owner > manage > edit > view
	const permissionRank = {
		view: 1,
		edit: 2,
		manage: 3,
		owner: 4,
	};

	if (permissionRank[permission] < permissionRank[requiredLevel]) {
		throw new ConvexError(
			`You need ${requiredLevel} permission to perform this action`,
		);
	}
}
