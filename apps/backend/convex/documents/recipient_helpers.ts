/**
 * Helper functions for document recipient management
 */

import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { generateStringHash } from "../crypto/helpers";

// Generic context type that works with both standard and custom auth contexts
type GenericCtx = Pick<MutationCtx | QueryCtx, "db">;

/**
 * Verify user is the document owner
 */
export async function verifyDocumentOwnership(
  ctx: GenericCtx,
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<void> {
  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new ConvexError("Document not found");
  }

  if (document.ownerId !== userId) {
    throw new ConvexError("Only the document owner can perform this action");
  }
}

/**
 * Find a recipient by their signing token using hash-based lookup.
 * Tries the secure tokenHash index first, falls back to plaintext
 * index for pre-migration records.
 *
 * @returns The recipient document, or null if not found
 */
export async function findRecipientByToken(
  ctx: GenericCtx,
  signingToken: string,
): Promise<Doc<"document_recipients"> | null> {
  const tokenHash = await generateStringHash(signingToken);

  // Try hash-based lookup first (secure path for new records)
  let recipient = await ctx.db
    .query("document_recipients")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .first();

  // Fallback to plaintext lookup for pre-migration records
  if (!recipient) {
    recipient = await ctx.db
      .query("document_recipients")
      .withIndex("by_token", (q) => q.eq("signingToken", signingToken))
      .first();
  }

  return recipient;
}

/**
 * Check if all required recipients have completed their actions
 */
export async function areAllRecipientsComplete(
  ctx: GenericCtx,
  documentId: Id<"documents">,
): Promise<boolean> {
  const recipients = await ctx.db
    .query("document_recipients")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  if (recipients.length === 0) {
    return false;
  }

  for (const recipient of recipients) {
    // Check if recipient has completed their required action
    const isComplete =
      (recipient.role === "signer" && recipient.status === "signed") ||
      (recipient.role === "approver" && recipient.status === "approved") ||
      (recipient.role === "viewer" && recipient.status === "viewed");

    if (!isComplete && recipient.status !== "declined") {
      return false;
    }
  }

  return true;
}

/**
 * Check if any recipient has declined
 */
export async function hasAnyRecipientDeclined(
  ctx: MutationCtx | QueryCtx,
  documentId: Id<"documents">,
): Promise<boolean> {
  const declinedRecipient = await ctx.db
    .query("document_recipients")
    .withIndex("by_document_status", (q) => q.eq("documentId", documentId).eq("status", "declined"))
    .first();

  return declinedRecipient !== null;
}

/**
 * Get count of recipients by role
 */
export async function getRecipientCounts(
  ctx: MutationCtx | QueryCtx,
  documentId: Id<"documents">,
): Promise<{
  total: number;
  signers: number;
  viewers: number;
  approvers: number;
}> {
  const recipients = await ctx.db
    .query("document_recipients")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  return {
    total: recipients.length,
    signers: recipients.filter((r) => r.role === "signer").length,
    viewers: recipients.filter((r) => r.role === "viewer").length,
    approvers: recipients.filter((r) => r.role === "approver").length,
  };
}
