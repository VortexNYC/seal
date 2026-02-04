/**
 * @fileoverview Recipients REST API internal queries and handlers.
 * Manages document recipients (signers, approvers, viewers) via the public API.
 *
 * @module api/v1/recipients
 * @requires seal:recipients:read scope for GET operations
 * @requires seal:recipients:write scope for POST/PUT/DELETE operations
 */

import { v } from "convex/values";

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
  status: "pending" | "viewed" | "signed" | "approved" | "declined";
  /** Signing order (for sequential signing) */
  order?: number;
  /** ISO 8601 timestamp when viewed */
  viewed_at?: string;
  /** ISO 8601 timestamp when signed/approved */
  completed_at?: string;
  /** Direct signing URL */
  signing_url?: string;
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
  },
  handler: async (ctx, args): Promise<ApiRecipient[] | null> => {
    // Verify document exists and belongs to the organization
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }
    if (document.organizationId !== args.organizationId) {
      return null;
    }

    // Get recipients
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Sort by order if present
    recipients.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    return recipients.map((r) => ({
      id: r._id,
      email: r.email,
      name: r.name ?? "",
      role: r.role,
      status: r.status,
      order: r.order,
      viewed_at: r.viewedAt ? new Date(r.viewedAt).toISOString() : undefined,
      completed_at:
        r.signedAt || r.approvedAt
          ? new Date((r.signedAt || r.approvedAt) as number).toISOString()
          : undefined,
      // Don't expose signing URL in list for security
    }));
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
    if (!document || document.status === "deleted") {
      return null;
    }
    if (document.organizationId !== args.organizationId) {
      return null;
    }

    // Get recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient || recipient.documentId !== args.documentId) {
      return null;
    }

    // Generate signing URL (only for draft/sent documents)
    let signingUrl: string | undefined;
    const workflowStatus = document.workflowStatus ?? "draft";
    if (
      (workflowStatus === "draft" ||
        workflowStatus === "sent" ||
        workflowStatus === "in_progress") &&
      recipient.status === "pending"
    ) {
      // Build signing URL with token
      signingUrl = `/sign/${recipient.signingToken}`;
    }

    return {
      id: recipient._id,
      email: recipient.email,
      name: recipient.name ?? "",
      role: recipient.role,
      status: recipient.status,
      order: recipient.order,
      viewed_at: recipient.viewedAt ? new Date(recipient.viewedAt).toISOString() : undefined,
      completed_at:
        recipient.signedAt || recipient.approvedAt
          ? new Date((recipient.signedAt || recipient.approvedAt) as number).toISOString()
          : undefined,
      signing_url: signingUrl,
    };
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

    // Check if recipient already exists
    const existing = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("email"), args.email))
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
      email: args.email,
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

    // TODO: Trigger reminder email via action

    return { success: true };
  },
});
