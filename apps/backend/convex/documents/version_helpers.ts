import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { DocumentVersionChangeType } from "../schemas/document_versions";

/**
 * Minimal context type for version helpers.
 * Works with both raw MutationCtx and auth-wrapped contexts (customCtx).
 */
type VersionMutationCtx = Pick<MutationCtx, "db">;

/**
 * Create a version snapshot of the current document state.
 *
 * This captures the document's metadata and storageId at this point in time,
 * inserts it into document_versions, and returns the new version number.
 *
 * Mirrors Catapult's createEstimateVersion helper pattern.
 */
export async function createVersionSnapshot(
  ctx: VersionMutationCtx,
  params: {
    documentId: Id<"documents">;
    createdBy: Id<"users">;
    changeType: DocumentVersionChangeType;
    changeDescription?: string;
    restoredFromVersion?: number;
  }
): Promise<number> {
  const document = await ctx.db.get(params.documentId);
  if (!document) {
    throw new Error(`Document ${params.documentId} not found`);
  }

  // Get the next version number by finding the latest existing version
  const latestVersion = await ctx.db
    .query("document_versions")
    .withIndex("by_document", (q) => q.eq("documentId", params.documentId))
    .order("desc")
    .first();

  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  await ctx.db.insert("document_versions", {
    documentId: params.documentId,
    versionNumber: nextVersionNumber,
    snapshot: {
      name: document.name,
      description: document.description,
      storageId: document.storageId,
      fileSize: document.fileSize,
      fileType: document.fileType,
      pageCount: document.pageCount,
      documentHash: document.documentHash,
    },
    changeType: params.changeType,
    changeDescription: params.changeDescription,
    restoredFromVersion: params.restoredFromVersion,
    createdBy: params.createdBy,
    createdAt: Date.now(),
  });

  return nextVersionNumber;
}
