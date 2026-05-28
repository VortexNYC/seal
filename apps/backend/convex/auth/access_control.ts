/**
 * Document Access Control Utilities
 *
 * Centralized access control logic for documents.
 * This eliminates duplication across multiple queries and mutations.
 *
 * Access is determined by:
 * 1. Ownership - Document owner always has full access
 * 2. Sharing Mode:
 *    - "private" - Only owner can access
 *    - "workspace" - All active organization members can access
 *    - "specific" - Only explicitly granted users can access
 * 3. Document Access Records - For "specific" sharing mode
 */

import type { GenericDatabaseReader } from "convex/server";
import { ConvexError } from "convex/values";

import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { DocumentPermissionLevel } from "../schemas/document_access";

/**
 * Minimal context type for access control functions.
 * Works with both raw QueryCtx/MutationCtx and auth-wrapped contexts.
 */
type DbContext = {
  db: GenericDatabaseReader<DataModel>;
};

/**
 * Document access check result
 */
export interface DocumentAccessResult {
  /** Whether the user has any access to the document */
  hasAccess: boolean;
  /** Whether the user is the document owner */
  isOwner: boolean;
  /** Whether access is via workspace sharing */
  isWorkspaceAccess: boolean;
  /** Whether access is via specific sharing */
  isSpecificAccess: boolean;
  /** Permission level if access is via specific sharing */
  permissionLevel?: DocumentPermissionLevel;
  /** The document access record if access is via specific sharing */
  accessRecord?: Doc<"document_access">;
  /** Whether user is an active organization member */
  isOrgMember: boolean;
}

/**
 * Standard error messages for access denial
 */
export const ACCESS_ERRORS = {
  DOCUMENT_NOT_FOUND: "Document not found",
  NO_ACCESS: "You don't have access to this document",
  NOT_ORG_MEMBER: "You are not a member of this organization",
  MANAGE_REQUIRED: "Only the document owner or managers can perform this action",
  OWNER_REQUIRED: "Only the document owner can perform this action",
} as const;

/**
 * Check if a user has access to a document
 *
 * This is the core access control function that should be used
 * by all document-related queries and mutations.
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check access for
 * @param document - The document to check access to
 * @returns DocumentAccessResult with detailed access information
 *
 * @example
 * const result = await checkDocumentAccess(ctx, userId, document);
 * if (!result.hasAccess) {
 *   throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
 * }
 */
export async function checkDocumentAccess(
  ctx: DbContext,
  userId: Id<"users">,
  document: Doc<"documents">,
): Promise<DocumentAccessResult> {
  const result: DocumentAccessResult = {
    hasAccess: false,
    isOwner: false,
    isWorkspaceAccess: false,
    isSpecificAccess: false,
    isOrgMember: false,
  };

  // 1. Check if user is the owner
  if (document.ownerId === userId) {
    result.hasAccess = true;
    result.isOwner = true;
    result.isOrgMember = true; // Owner is always a member
    return result;
  }

  // 2. Check organization membership
  const member = await ctx.db
    .query("organization_members")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", document.organizationId),
    )
    .first();

  if (!member || member.status !== "active") {
    return result; // Not an active member, no access
  }

  result.isOrgMember = true;

  // 3. Check sharing mode
  if (document.sharingMode === "workspace") {
    result.hasAccess = true;
    result.isWorkspaceAccess = true;
    return result;
  }

  if (document.sharingMode === "specific") {
    const access = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) => q.eq("documentId", document._id).eq("userId", userId))
      .first();

    if (access && access.revokedAt === undefined) {
      result.hasAccess = true;
      result.isSpecificAccess = true;
      result.permissionLevel = access.permissionLevel;
      result.accessRecord = access;
      return result;
    }
  }

  // "private" sharing mode or no specific access granted
  return result;
}

/**
 * Check document access and throw if no access
 *
 * Convenience wrapper around checkDocumentAccess that throws
 * a ConvexError if the user doesn't have access.
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check access for
 * @param document - The document to check access to
 * @param errorMessage - Optional custom error message
 * @returns DocumentAccessResult (only if access is granted)
 * @throws ConvexError if user doesn't have access
 *
 * @example
 * const access = await requireDocumentAccess(ctx, userId, document);
 * // If we get here, user has access
 */
export async function requireDocumentAccess(
  ctx: DbContext,
  userId: Id<"users">,
  document: Doc<"documents">,
  errorMessage?: string,
): Promise<DocumentAccessResult> {
  const result = await checkDocumentAccess(ctx, userId, document);

  if (!result.hasAccess) {
    throw new ConvexError(errorMessage ?? ACCESS_ERRORS.NO_ACCESS);
  }

  return result;
}

/**
 * Check if user can manage a document (owner or has "manage" permission)
 *
 * Management includes: sharing, revoking access, changing permissions,
 * transferring ownership.
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check
 * @param document - The document to check
 * @returns boolean indicating if user can manage
 */
export async function canManageDocument(
  ctx: DbContext,
  userId: Id<"users">,
  document: Doc<"documents">,
): Promise<boolean> {
  // Owner can always manage
  if (document.ownerId === userId) {
    return true;
  }

  // Verify user is an active organization member before checking access records
  const member = await ctx.db
    .query("organization_members")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", document.organizationId),
    )
    .first();

  if (!member || member.status !== "active") {
    return false;
  }

  // Check for "manage" permission level
  const access = await ctx.db
    .query("document_access")
    .withIndex("by_document_user", (q) => q.eq("documentId", document._id).eq("userId", userId))
    .first();

  return access !== null && access.permissionLevel === "manage" && access.revokedAt === undefined;
}

/**
 * Check if user can manage a document and throw if not
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check
 * @param document - The document to check
 * @param errorMessage - Optional custom error message
 * @throws ConvexError if user cannot manage
 */
export async function requireManageAccess(
  ctx: DbContext,
  userId: Id<"users">,
  document: Doc<"documents">,
  errorMessage?: string,
): Promise<void> {
  const canManage = await canManageDocument(ctx, userId, document);

  if (!canManage) {
    throw new ConvexError(errorMessage ?? ACCESS_ERRORS.MANAGE_REQUIRED);
  }
}

/**
 * Check if user is the document owner and throw if not
 *
 * @param userId - The user ID to check
 * @param document - The document to check
 * @param errorMessage - Optional custom error message
 * @throws ConvexError if user is not the owner
 */
export function requireOwnership(
  userId: Id<"users">,
  document: Doc<"documents">,
  errorMessage?: string,
): void {
  if (document.ownerId !== userId) {
    throw new ConvexError(errorMessage ?? ACCESS_ERRORS.OWNER_REQUIRED);
  }
}

/**
 * Verify user is a member of an organization
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check
 * @param organizationId - The organization ID
 * @returns The membership record if active, null otherwise
 */
export async function getActiveMembership(
  ctx: DbContext,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<Doc<"organization_members"> | null> {
  const member = await ctx.db
    .query("organization_members")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  if (!member || member.status !== "active") {
    return null;
  }

  return member;
}

/**
 * Verify user is a member of an organization and throw if not
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check
 * @param organizationId - The organization ID
 * @param errorMessage - Optional custom error message
 * @returns The membership record
 * @throws ConvexError if user is not an active member
 */
export async function requireActiveMembership(
  ctx: DbContext,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  errorMessage?: string,
): Promise<Doc<"organization_members">> {
  const member = await getActiveMembership(ctx, userId, organizationId);

  if (!member) {
    throw new ConvexError(errorMessage ?? ACCESS_ERRORS.NOT_ORG_MEMBER);
  }

  return member;
}

/**
 * Get document with "not found" check
 *
 * Common pattern: get document and throw if not found or deleted
 *
 * @param ctx - Query or Mutation context
 * @param documentId - The document ID to fetch
 * @param errorMessage - Optional custom error message
 * @returns The document
 * @throws ConvexError if document not found or deleted
 */
export async function getDocumentOrThrow(
  ctx: DbContext,
  documentId: Id<"documents">,
  errorMessage?: string,
): Promise<Doc<"documents">> {
  const document = await ctx.db.get(documentId);

  if (!document || document.status === "deleted") {
    throw new ConvexError(errorMessage ?? ACCESS_ERRORS.DOCUMENT_NOT_FOUND);
  }

  return document;
}

/**
 * Combined helper: Get document and verify access
 *
 * This is the most common pattern - fetch document and check access in one call.
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check access for
 * @param documentId - The document ID to fetch
 * @returns Object containing document and access result
 * @throws ConvexError if document not found or user doesn't have access
 *
 * @example
 * const { document, access } = await getDocumentWithAccessCheck(ctx, userId, documentId);
 * // document is guaranteed to exist and user has access
 */
export async function getDocumentWithAccessCheck(
  ctx: DbContext,
  userId: Id<"users">,
  documentId: Id<"documents">,
): Promise<{ document: Doc<"documents">; access: DocumentAccessResult }> {
  const document = await getDocumentOrThrow(ctx, documentId);
  const access = await requireDocumentAccess(ctx, userId, document);

  return { document, access };
}

/**
 * Combined helper: Get document and verify manage access
 *
 * For operations that require management permissions.
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check access for
 * @param documentId - The document ID to fetch
 * @returns The document
 * @throws ConvexError if document not found or user cannot manage
 */
export async function getDocumentWithManageCheck(
  ctx: DbContext,
  userId: Id<"users">,
  documentId: Id<"documents">,
): Promise<Doc<"documents">> {
  const document = await getDocumentOrThrow(ctx, documentId);
  await requireManageAccess(ctx, userId, document);

  return document;
}

/**
 * Check document access for a list of documents (batch operation)
 *
 * Efficiently checks access for multiple documents, useful for list views.
 * Already verified membership is required before calling this.
 *
 * @param ctx - Query or Mutation context
 * @param userId - The user ID to check access for
 * @param documents - Array of documents to check
 * @returns Array of documents the user has access to
 */
export async function filterAccessibleDocuments(
  ctx: DbContext,
  userId: Id<"users">,
  documents: Doc<"documents">[],
): Promise<Doc<"documents">[]> {
  const accessible: Doc<"documents">[] = [];

  for (const doc of documents) {
    const result = await checkDocumentAccess(ctx, userId, doc);
    if (result.hasAccess) {
      accessible.push(doc);
    }
  }

  return accessible;
}
