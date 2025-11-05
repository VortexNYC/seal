/**
 * Document mutations for Seal - Document Sharing
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { authMutation } from "../auth";
import { validateFile } from "./upload_config";

/**
 * Generate an upload URL for document storage
 * This allows the client to upload a file directly to Convex Storage
 */
export const generateUploadUrl = authMutation({
	args: {},
	handler: async (ctx) => {
		// User must be authenticated (authMutation ensures this)
		return await ctx.storage.generateUploadUrl();
	},
});

/**
 * Create a document record after file upload
 * Called after the client successfully uploads the file to Convex Storage
 */
export const createDocument = authMutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.string(),
		description: v.optional(v.string()),
		fileSize: v.number(),
		fileType: v.string(),
		storageId: v.string(), // ID returned from storage upload
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Validate file before processing
		const validation = validateFile(args.name, args.fileType, args.fileSize);
		if (!validation.valid) {
			throw new ConvexError(
				`File validation failed: ${validation.errors.join(", ")}`,
			);
		}

		// 2. Verify user is a member of the organization
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", userId).eq("organizationId", args.organizationId),
			)
			.first();

		if (!member) {
			throw new ConvexError("You are not a member of this organization");
		}

		if (member.status !== "active") {
			throw new ConvexError("Your organization membership is not active");
		}

		// 3. Create the document record (default to private sharing)
		const documentId = await ctx.db.insert("documents", {
			organizationId: args.organizationId,
			ownerId: userId,
			name: args.name,
			description: args.description,
			fileSize: args.fileSize,
			fileType: args.fileType,
			storageId: args.storageId,
			sharingMode: "private", // Default to private
			status: "active",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		return documentId;
	},
});

/**
 * Delete a document (marks as deleted, can archive storage later)
 */
export const deleteDocument = authMutation({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 2. Verify user is the owner (only owners can delete)
		if (document.ownerId !== userId) {
			throw new ConvexError("Only the document owner can delete this document");
		}

		// 3. Mark as deleted (soft delete)
		await ctx.db.patch(args.documentId, {
			status: "deleted",
			updatedAt: Date.now(),
		});

		// 4. Schedule storage cleanup after 7 day grace period
		// This allows document recovery if needed
		const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
		await ctx.scheduler.runAfter(
			GRACE_PERIOD_MS,
			internal.documents.cleanup.cleanupDocumentStorage,
			{
				storageId: document.storageId,
				documentId: args.documentId,
			},
		);

		return { success: true };
	},
});

/**
 * Update document metadata (name, description)
 */
export const updateDocument = authMutation({
	args: {
		documentId: v.id("documents"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 2. Check if user has edit access (owner or has "edit"/"manage" permission)
		let hasEditAccess = false;
		if (document.ownerId !== userId) {
			const access = await ctx.db
				.query("document_access")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", args.documentId).eq("userId", userId),
				)
				.first();

			hasEditAccess =
				access !== null &&
				(access.permissionLevel === "edit" ||
					access.permissionLevel === "manage");
		}

		if (!hasEditAccess && document.ownerId !== userId) {
			throw new ConvexError("You don't have permission to edit this document");
		}

		// 3. Update the document
		const updateData: {
			name?: string;
			description?: string;
			updatedAt: number;
		} = {
			updatedAt: Date.now(),
		};

		if (args.name !== undefined) {
			updateData.name = args.name;
		}
		if (args.description !== undefined) {
			updateData.description = args.description;
		}

		await ctx.db.patch(args.documentId, updateData);

		return { success: true };
	},
});
