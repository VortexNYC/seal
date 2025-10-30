/**
 * Internal mutations for document cleanup
 * These functions are called by scheduled tasks and cannot be called directly from the client
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Cleanup storage for a deleted document
 * This is called by a scheduled task after the grace period
 */
export const cleanupDocumentStorage = internalMutation({
	args: {
		storageId: v.string(),
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		try {
			// 1. Verify document is still marked as deleted
			const document = await ctx.db.get(args.documentId);

			// Only delete storage if document is still deleted (or doesn't exist)
			if (!document || document.status === "deleted") {
				// 2. Delete the file from Convex Storage
				await ctx.storage.delete(args.storageId);

				console.log(
					`Storage cleanup: Deleted file ${args.storageId} for document ${args.documentId}`,
				);

				return { success: true, deleted: true };
			}

			// Document was restored, don't delete storage
			console.log(
				`Storage cleanup: Skipped deletion for ${args.storageId} - document was restored`,
			);
			return { success: true, deleted: false, reason: "document_restored" };
		} catch (error) {
			console.error(
				`Storage cleanup error for ${args.storageId}:`,
				error,
			);
			throw error;
		}
	},
});

/**
 * Batch cleanup for multiple documents
 * Useful for admin cleanup tasks
 */
export const batchCleanupDocumentStorage = internalMutation({
	args: {
		items: v.array(
			v.object({
				storageId: v.string(),
				documentId: v.id("documents"),
			}),
		),
	},
	handler: async (ctx, args) => {
		const results = {
			total: args.items.length,
			deleted: 0,
			skipped: 0,
			errors: 0,
		};

		for (const item of args.items) {
			try {
				const document = await ctx.db.get(item.documentId);

				if (!document || document.status === "deleted") {
					await ctx.storage.delete(item.storageId);
					results.deleted++;
				} else {
					results.skipped++;
				}
			} catch (error) {
				console.error(
					`Batch cleanup error for ${item.storageId}:`,
					error,
				);
				results.errors++;
			}
		}

		console.log(
			`Batch cleanup completed: ${results.deleted} deleted, ${results.skipped} skipped, ${results.errors} errors`,
		);

		return results;
	},
});
