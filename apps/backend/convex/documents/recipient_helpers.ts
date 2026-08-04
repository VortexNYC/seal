/**
 * Helper functions for document recipient management
 */

import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { generateStringHash } from "../crypto/helpers";
import { isRecipientTerminal } from "../schemas/document_recipients";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

// Generic context type that works with both standard and custom auth contexts
type GenericCtx = Pick<MutationCtx | QueryCtx, "db">;

/**
 * Verify user is the document owner
 */
export async function verifyDocumentOwnership(
  ctx: GenericCtx,
  documentId: Id<"documents">,
  userId: Id<"users">
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
  signingToken: string
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
  documentId: Id<"documents">
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
  documentId: Id<"documents">
): Promise<boolean> {
  const declinedRecipient = await ctx.db
    .query("document_recipients")
    .withIndex("by_document_status", (q) =>
      q.eq("documentId", documentId).eq("status", "declined")
    )
    .first();

  return declinedRecipient !== null;
}

/**
 * Group recipients by their order value, sorted ascending.
 * Recipients with undefined/null order are treated as order 0.
 */
export function groupRecipientsByOrder(
  recipients: Doc<"document_recipients">[]
): Map<number, Doc<"document_recipients">[]> {
  const groups = new Map<number, Doc<"document_recipients">[]>();
  for (const r of recipients) {
    const order = r.order ?? 0;
    if (!groups.has(order)) groups.set(order, []);
    sealAssertPresent(groups.get(order)).push(r);
  }
  return new Map([...groups].sort(([a], [b]) => a - b));
}

/**
 * Find the first order group where not all recipients are in a terminal state.
 */
export function findFirstIncompleteGroup(
  recipients: Doc<"document_recipients">[]
): Doc<"document_recipients">[] {
  const groups = groupRecipientsByOrder(recipients);
  for (const [_order, group] of groups) {
    if (!group.every((r) => isRecipientTerminal(r.status))) {
      return group;
    }
  }
  return [];
}

/**
 * Check whether a specific recipient's order group is active
 * (all recipients in previous groups have reached terminal state).
 */
export function isRecipientGroupActive(
  recipient: Doc<"document_recipients">,
  allRecipients: Doc<"document_recipients">[]
): boolean {
  const myOrder = recipient.order ?? 0;
  return allRecipients
    .filter((r) => (r.order ?? 0) < myOrder)
    .every((r) => isRecipientTerminal(r.status));
}

/**
 * Get the next pending order group after a completed group.
 * Returns recipients that are pending and whose group just became active.
 */
export function getNextPendingGroup(
  allRecipients: Doc<"document_recipients">[],
  completedOrder: number
): Doc<"document_recipients">[] {
  const groups = groupRecipientsByOrder(allRecipients);
  const sortedOrders = [...groups.keys()];

  // Find the next order after completedOrder
  for (const order of sortedOrders) {
    if (order > completedOrder) {
      const group = sealAssertPresent(groups.get(order));
      // Only return if the group has pending recipients
      const pendingInGroup = group.filter((r) => r.status === "pending");
      if (pendingInGroup.length > 0) {
        return pendingInGroup;
      }
    }
  }
  return [];
}

/**
 * Get count of recipients by role
 */
export async function getRecipientCounts(
  ctx: MutationCtx | QueryCtx,
  documentId: Id<"documents">
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
