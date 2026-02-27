/**
 * Helper functions for document workflow status management
 */

import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { DocumentWorkflowStatus } from "../schemas/document_workflow_status";
import { isValidWorkflowTransition } from "../schemas/document_workflow_status";

// Generic context type that works with both standard and custom auth contexts
type GenericMutationCtx = Pick<MutationCtx, "db">;

/**
 * Transition a document to a new workflow status
 * Validates the transition and updates timestamps accordingly
 */
export async function transitionWorkflowStatus(
  ctx: GenericMutationCtx,
  documentId: Id<"documents">,
  newStatus: DocumentWorkflowStatus,
): Promise<void> {
  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new ConvexError("Document not found");
  }

  // Default to draft if workflowStatus is not set (migration support)
  const currentStatus = document.workflowStatus ?? "draft";

  // Validate transition
  if (!isValidWorkflowTransition(currentStatus, newStatus)) {
    throw new ConvexError(`Invalid workflow transition from ${currentStatus} to ${newStatus}`);
  }

  // Prepare update with new status and timestamp
  const updateData: {
    workflowStatus: DocumentWorkflowStatus;
    updatedAt: number;
    sentAt?: number;
    completedAt?: number;
    cancelledAt?: number;
    declinedAt?: number;
    expiredAt?: number;
  } = {
    workflowStatus: newStatus,
    updatedAt: Date.now(),
  };

  // Set appropriate timestamp based on new status
  const now = Date.now();
  switch (newStatus) {
    case "sent":
      updateData.sentAt = now;
      break;
    case "completed":
      updateData.completedAt = now;
      break;
    case "cancelled":
      updateData.cancelledAt = now;
      break;
    case "declined":
      updateData.declinedAt = now;
      break;
    case "expired":
      updateData.expiredAt = now;
      break;
  }

  await ctx.db.patch(documentId, updateData);
}

/**
 * Check if a document is in a terminal state (cannot be modified)
 */
export function isTerminalWorkflowStatus(status: DocumentWorkflowStatus): boolean {
  return (
    status === "completed" ||
    status === "cancelled" ||
    status === "declined" ||
    status === "expired"
  );
}

/**
 * Check if a document can be sent
 */
export function canSendDocument(status: DocumentWorkflowStatus): boolean {
  return status === "draft" || status === "expired";
}

/**
 * Check if a document workflow can be cancelled
 */
export function canCancelDocument(status: DocumentWorkflowStatus): boolean {
  return !isTerminalWorkflowStatus(status);
}

/**
 * Check if a document can be completed
 */
export function canCompleteDocument(status: DocumentWorkflowStatus): boolean {
  return status === "in_progress" || status === "waiting_for_payment";
}

/**
 * Verify user has permission to modify document workflow
 */
export async function verifyDocumentOwnership(
  ctx: GenericMutationCtx,
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<void> {
  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new ConvexError("Document not found");
  }

  if (document.ownerId !== userId) {
    throw new ConvexError("Only the document owner can modify the workflow status");
  }
}
