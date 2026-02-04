/**
 * Internal mutations for document cleanup
 * These functions are called by scheduled tasks and cannot be called directly from the client
 */

import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";

/**
 * Helper function to perform the actual cleanup logic
 * Shared between single and batch cleanup operations
 */
async function performCleanup(
  ctx: MutationCtx,
  storageId: string,
  documentId: Id<"documents">,
): Promise<{ deleted: boolean; reason?: string }> {
  // 1. Verify document is still marked as deleted
  const document = await ctx.db.get(documentId);

  // Only delete storage if document is still deleted (or doesn't exist)
  if (!document || document.status === "deleted") {
    // 2. Delete the file from Convex Storage
    await ctx.storage.delete(storageId);

    console.info(`Storage cleanup: Deleted file ${storageId} for document ${documentId}`);

    return { deleted: true };
  }

  // Document was restored, don't delete storage
  console.info(`Storage cleanup: Skipped deletion for ${storageId} - document was restored`);
  return { deleted: false, reason: "document_restored" };
}

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
      const result = await performCleanup(ctx, args.storageId, args.documentId);

      return { success: true, ...result };
    } catch (error) {
      console.error(`Storage cleanup error for ${args.storageId}:`, error);
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
        const result = await performCleanup(ctx, item.storageId, item.documentId);

        if (result.deleted) {
          results.deleted++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        console.error(`Batch cleanup error for ${item.storageId}:`, error);
        results.errors++;
      }
    }

    console.info(
      `Batch cleanup completed: ${results.deleted} deleted, ${results.skipped} skipped, ${results.errors} errors`,
    );

    return results;
  },
});
