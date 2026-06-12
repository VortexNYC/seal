/**
 * @fileoverview Recipients REST API internal queries and handlers.
 * Manages document recipients (signers, approvers, viewers) via the public API.
 *
 * @module api/v1/recipients
 * @requires seal:recipients:read scope for GET operations
 * @requires seal:recipients:write scope for POST/PUT/DELETE operations
 */

import { v } from "convex/values";

import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * API recipient response format.
 */
export interface ApiRecipient {
  /** Unique recipient identifier */
  id: string;
  /** Recipient email address */
  email: string;
  /** Recipient display name */
  name: string;
  /** Role in the signing workflow */
  role: "signer" | "approver" | "viewer";
  /** Current status */
  status: "pending" | "viewed" | "signed" | "approved" | "declined" | "expired";
  /** Signing order (for sequential signing) */
  order?: number;
  /** ISO 8601 timestamp when viewed */
  viewed_at?: string;
  /** ISO 8601 timestamp when signed/approved */
  completed_at?: string;
  /** Direct signing URL */
  signing_url?: string;
}

type ApiDocument = Doc<"documents">;
type ApiDocumentRecipient = Doc<"document_recipients">;

function isDocumentAccessible(
  document: ApiDocument | null,
  organizationId: Id<"organizations">,
): document is ApiDocument {
  return Boolean(
    document && document.status !== "deleted" && document.organizationId === organizationId,
  );
}

function getCompletedAtIso(
  recipient: Pick<ApiDocumentRecipient, "signedAt" | "approvedAt">,
): string | undefined {
  const completedAt = recipient.signedAt || recipient.approvedAt;
  return completedAt ? new Date(completedAt).toISOString() : undefined;
}

function buildApiRecipient(recipient: ApiDocumentRecipient, signingUrl?: string): ApiRecipient {
  return {
    id: recipient._id,
    email: recipient.email,
    name: recipient.name ?? "",
    role: recipient.role,
    status: recipient.status,
    order: recipient.order,
    viewed_at: recipient.viewedAt ? new Date(recipient.viewedAt).toISOString() : undefined,
    completed_at: getCompletedAtIso(recipient),
    signing_url: signingUrl,
  };
}

function getSigningUrl(
  workflowStatus: ApiDocument["workflowStatus"],
  recipient: Pick<ApiDocumentRecipient, "status" | "signingToken">,
): string | undefined {
  const activeWorkflow =
    workflowStatus === "draft" || workflowStatus === "sent" || workflowStatus === "in_progress";
  if (activeWorkflow && recipient.status === "pending") {
    return `/sign/${recipient.signingToken}`;
  }
  return undefined;
}

/**
 * Internal query to list recipients for a document.
 *
 * @internal
 */
export const listRecipients = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("viewed"),
        v.literal("signed"),
        v.literal("approved"),
        v.literal("declined"),
        v.literal("expired"),
      ),
    ),
    role: v.optional(v.union(v.literal("signer"), v.literal("approver"), v.literal("viewer"))),
    sort: v.optional(
      v.union(
        v.literal("order"),
        v.literal("email"),
        v.literal("name"),
        v.literal("status"),
        v.literal("role"),
        v.literal("created_at"),
        v.literal("updated_at"),
      ),
    ),
    sort_direction: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    search: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    recipients: ApiRecipient[];
    has_more: boolean;
    next_cursor?: string;
  } | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!isDocumentAccessible(document, args.organizationId)) {
      return null;
    }

    // Get recipients
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Apply filters
    let filtered = recipients;
    if (args.status) {
      filtered = filtered.filter((r) => r.status === args.status);
    }
    if (args.role) {
      filtered = filtered.filter((r) => r.role === args.role);
    }
    if (args.search) {
      const term = args.search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.email.toLowerCase().includes(term) || (r.name ?? "").toLowerCase().includes(term),
      );
    }

    // Apply sorting
    const sortField = args.sort ?? "order";
    const sortDirection = args.sort_direction === "desc" ? -1 : 1;

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "order":
          comparison = (a.order ?? Infinity) - (b.order ?? Infinity);
          break;
        case "email":
          comparison = a.email.localeCompare(b.email);
          break;
        case "name":
          comparison = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "role":
          comparison = a.role.localeCompare(b.role);
          break;
        case "created_at":
          comparison = a.createdAt - b.createdAt;
          break;
        case "updated_at":
          comparison = a.updatedAt - b.updatedAt;
          break;
      }
      return comparison * sortDirection;
    });

    // Pagination
    const limit = Math.min(args.limit ?? 20, 100);
    let start = 0;
    if (args.cursor) {
      const idx = filtered.findIndex((r) => r._id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = filtered.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?._id : undefined;

    return {
      recipients: items.map((recipient) => buildApiRecipient(recipient)),
      has_more,
      next_cursor,
    };
  },
});

/**
 * Internal query to get a single recipient.
 *
 * @internal
 */
export const getRecipient = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args): Promise<ApiRecipient | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!isDocumentAccessible(document, args.organizationId)) {
      return null;
    }

    // Get recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient || recipient.documentId !== args.documentId) {
      return null;
    }

    const signingUrl = getSigningUrl(document.workflowStatus ?? "draft", recipient);
    return buildApiRecipient(recipient, signingUrl);
  },
});

/**
 * Generates a unique signing token for recipients.
 */
function generateSigningToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Internal mutation to add a recipient to a document.
 *
 * @internal
 */
export const addRecipient = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("signer"), v.literal("approver"), v.literal("viewer")),
    order: v.optional(v.number()),
    customMessage: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; recipientId?: string; error?: string }> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return { success: false, error: "Document not found" };
    }
    if (document.organizationId !== args.organizationId) {
      return { success: false, error: "Document not found" };
    }

    // Can only add recipients to draft or in_progress documents
    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus !== "draft" && workflowStatus !== "in_progress") {
      return {
        success: false,
        error: `Cannot add recipients to document with status: ${workflowStatus}`,
      };
    }

    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if recipient already exists
    const existing = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .first();

    if (existing) {
      return {
        success: false,
        error: "Recipient with this email already exists",
      };
    }

    // Generate signing token
    const signingToken = generateSigningToken();
    const tokenExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Create recipient
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId: args.documentId,
      email: normalizedEmail,
      name: args.name,
      role: args.role,
      status: "pending",
      order: args.order,
      signingToken,
      tokenExpiresAt,
      customMessage: args.customMessage,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, recipientId };
  },
});

/**
 * Internal mutation to update a recipient.
 *
 * @internal
 */
export const updateRecipient = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("signer"), v.literal("approver"), v.literal("viewer"))),
    order: v.optional(v.number()),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return { success: false, error: "Document not found" };
    }
    if (document.organizationId !== args.organizationId) {
      return { success: false, error: "Document not found" };
    }

    // Get recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient || recipient.documentId !== args.documentId) {
      return { success: false, error: "Recipient not found" };
    }

    // Cannot update recipients who have already signed/approved/declined
    if (recipient.status !== "pending" && recipient.status !== "viewed") {
      return {
        success: false,
        error: `Cannot update recipient with status: ${recipient.status}`,
      };
    }

    // Build update data
    const updateData: {
      name?: string;
      role?: "signer" | "approver" | "viewer";
      order?: number;
      customMessage?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updateData.name = args.name;
    }
    if (args.role !== undefined) {
      updateData.role = args.role;
    }
    if (args.order !== undefined) {
      updateData.order = args.order;
    }
    if (args.customMessage !== undefined) {
      updateData.customMessage = args.customMessage;
    }

    await ctx.db.patch(args.recipientId, updateData);

    return { success: true };
  },
});

/**
 * Internal mutation to remove a recipient from a document.
 *
 * @internal
 */
export const removeRecipient = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return { success: false, error: "Document not found" };
    }
    if (document.organizationId !== args.organizationId) {
      return { success: false, error: "Document not found" };
    }

    // Get recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient || recipient.documentId !== args.documentId) {
      return { success: false, error: "Recipient not found" };
    }

    // Cannot remove recipients who have already signed/approved
    if (recipient.status === "signed" || recipient.status === "approved") {
      return {
        success: false,
        error: "Cannot remove recipient who has already signed or approved",
      };
    }

    // Delete recipient
    await ctx.db.delete(args.recipientId);

    return { success: true };
  },
});

/**
 * Internal mutation to send a reminder to a recipient.
 *
 * @internal
 */
export const sendReminder = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return { success: false, error: "Document not found" };
    }
    if (document.organizationId !== args.organizationId) {
      return { success: false, error: "Document not found" };
    }

    // Document must be sent or in_progress
    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus !== "sent" && workflowStatus !== "in_progress") {
      return {
        success: false,
        error: "Can only send reminders for sent or in-progress documents",
      };
    }

    // Get recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient || recipient.documentId !== args.documentId) {
      return { success: false, error: "Recipient not found" };
    }

    // Cannot remind recipients who have already completed
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      return {
        success: false,
        error: `Cannot send reminder to recipient with status: ${recipient.status}`,
      };
    }

    // Schedule reminder email as a background action
    await ctx.scheduler.runAfter(
      0,
      internal.documents.reminder_email_action.sendReminderEmailDirect,
      {
        documentId: args.documentId,
        recipientId: args.recipientId,
        customMessage: args.message,
      },
    );

    return { success: true };
  },
});
