/**
 * Document recipients mutations for Seal
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { logRecipientAction } from "../audit_logs/helpers";
import { authMutation, permissionMutation } from "../auth";
import { generateStringHash } from "../crypto/helpers";
import {
  isRecipientComplete,
  recipientRoleTuple,
  recipientStatusTuple,
} from "../schemas/document_recipients";
import { publishWebhookEvent } from "../webhooks/publish";
import { findRecipientByToken, verifyDocumentOwnership } from "./recipient_helpers";

/**
 * Generate a unique signing token and its SHA-256 hash.
 * The plaintext token is sent to the recipient via email URL.
 * Only the hash is used for secure database lookups.
 */
async function generateSigningToken(): Promise<{
  token: string;
  tokenHash: string;
}> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const tokenHash = await generateStringHash(token);
  return { token, tokenHash };
}

/**
 * Add recipients to a document
 * Can only be called on draft documents by the owner
 * Requires documents:edit permission
 */
export const addRecipients = permissionMutation("documents:edit")({
  args: {
    documentId: v.id("documents"),
    recipients: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
        role: recipientRoleTuple,
        order: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 3. Verify document is in draft status
    if (document.status === "deleted") {
      throw new ConvexError("Cannot add recipients to deleted document");
    }

    // 4. Validate recipients
    if (args.recipients.length === 0) {
      throw new ConvexError("At least one recipient is required");
    }

    // Check for duplicate emails
    const emails = args.recipients.map((r) => r.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      throw new ConvexError("Duplicate recipient emails are not allowed");
    }

    // 5. Get user for audit logging
    const user = await ctx.db.get(userId);

    // 6. Create recipient records
    const recipientIds = [];
    const now = Date.now();
    const tokenExpiration = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

    for (const recipient of args.recipients) {
      const { token, tokenHash } = await generateSigningToken();
      const recipientId = await ctx.db.insert("document_recipients", {
        documentId: args.documentId,
        email: recipient.email.toLowerCase(),
        name: recipient.name,
        role: recipient.role,
        status: "pending",
        order: recipient.order,
        signingToken: token,
        tokenHash,
        tokenExpiresAt: tokenExpiration,
        createdAt: now,
        updatedAt: now,
      });
      recipientIds.push(recipientId);

      // Audit log
      if (user) {
        await logRecipientAction(ctx, {
          organizationId: document.organizationId,
          actorType: "user",
          actorId: user.clerkId,
          userId: user.clerkId,
          action: "recipient.added",
          documentId: args.documentId,
          recipientId,
          newValues: {
            email: recipient.email.toLowerCase(),
            name: recipient.name,
            role: recipient.role,
          },
          ipAddress: "web-authenticated",
        });
      }
    }

    return { recipientIds, count: recipientIds.length };
  },
});

/**
 * Remove a recipient from a document
 * Can only be called on draft documents by the owner
 * Requires documents:edit permission
 * Also removes all signature fields assigned to the recipient
 */
export const removeRecipient = permissionMutation("documents:edit")({
  args: {
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new ConvexError("Recipient not found");
    }

    // 2. Verify ownership of the document
    await verifyDocumentOwnership(ctx, recipient.documentId, userId);

    // 3. Get the document
    const document = await ctx.db.get(recipient.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 4. Verify document is in draft status
    if (document.status === "deleted") {
      throw new ConvexError("Cannot remove recipients from deleted document");
    }

    // 5. Get user for audit logging
    const user = await ctx.db.get(userId);

    // 6. Find and delete all signature fields assigned to this recipient
    const fieldsToDelete = await ctx.db
      .query("signature_fields")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .collect();

    for (const field of fieldsToDelete) {
      // Cascade-delete payment config if this is a payment field
      if (field.fieldType === "payment") {
        const paymentConfig = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .unique();
        if (paymentConfig) {
          await ctx.db.delete(paymentConfig._id);
        }
      }
      await ctx.db.delete(field._id);
    }

    // 7. Audit log before deletion (capture recipient info)
    if (user) {
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "user",
        actorId: user.clerkId,
        userId: user.clerkId,
        action: "recipient.removed",
        documentId: recipient.documentId,
        recipientId: args.recipientId,
        newValues: {
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          deletedFieldsCount: fieldsToDelete.length,
        },
        ipAddress: "web-authenticated",
      });
    }

    // 8. Delete the recipient
    await ctx.db.delete(args.recipientId);

    return { success: true, deletedFieldsCount: fieldsToDelete.length };
  },
});

/**
 * Update recipient status (internal use - called by recipient actions)
 * This mutation can be called by anyone with a valid signing token
 */
export const updateRecipientStatus = authMutation({
  args: {
    signingToken: v.string(),
    status: recipientStatusTuple,
    signatureData: v.optional(v.string()),
    signatureType: v.optional(
      v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded")),
    ),
    declineReason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Find recipient by signing token (hash-based lookup with plaintext fallback)
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    // 2. Check token expiration
    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }

    // 3. Validate status transition
    // Cannot change status if already in terminal state
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      throw new ConvexError(`Cannot update status - recipient has already ${recipient.status}`);
    }

    // 4. Validate status change is appropriate for role
    if (args.status === "signed" && recipient.role !== "signer") {
      throw new ConvexError("Only signers can have status 'signed'");
    }
    if (args.status === "approved" && recipient.role !== "approver") {
      throw new ConvexError("Only approvers can have status 'approved'");
    }

    // 5. Validate required data
    if (args.status === "signed") {
      if (!args.signatureData || !args.signatureType) {
        throw new ConvexError("Signature data and type are required for signing");
      }
    }
    if (args.status === "declined" && !args.declineReason) {
      throw new ConvexError("Decline reason is required");
    }

    // 6. Update the recipient
    const now = Date.now();
    const updateData: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    // Set appropriate timestamp
    switch (args.status) {
      case "viewed":
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "signed":
        updateData.signedAt = now;
        updateData.signatureData = args.signatureData;
        updateData.signatureType = args.signatureType;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "approved":
        updateData.approvedAt = now;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "declined":
        updateData.declinedAt = now;
        updateData.declineReason = args.declineReason;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
    }

    if (args.ipAddress) {
      updateData.ipAddress = args.ipAddress;
    }

    await ctx.db.patch(recipient._id, updateData);

    return { success: true, recipientId: recipient._id };
  },
});

/**
 * Submit recipient signature (public mutation - no auth required)
 * Called by recipients on the public signing page using their signing token
 */
export const submitRecipientSignature = mutation({
  args: {
    signingToken: v.string(),
    status: recipientStatusTuple,
    signatureData: v.optional(v.string()),
    signatureType: v.optional(
      v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded")),
    ),
    declineReason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Find recipient by signing token (hash-based lookup with plaintext fallback)
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    // 2. Check token expiration
    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }

    // 3. Validate status transition
    // Cannot change status if already in terminal state
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      throw new ConvexError(`Cannot update status - recipient has already ${recipient.status}`);
    }

    // 4. Validate status change is appropriate for role
    if (args.status === "signed" && recipient.role !== "signer") {
      throw new ConvexError("Only signers can have status 'signed'");
    }
    if (args.status === "approved" && recipient.role !== "approver") {
      throw new ConvexError("Only approvers can have status 'approved'");
    }

    // 5. Validate required data
    if (args.status === "signed") {
      if (!args.signatureData || !args.signatureType) {
        throw new ConvexError("Signature data and type are required for signing");
      }
    }
    if (args.status === "declined" && !args.declineReason) {
      throw new ConvexError("Decline reason is required");
    }

    // 5b. Enforce payment completion before signing/approving
    if (args.status === "signed" || args.status === "approved") {
      const paymentFields = await ctx.db
        .query("signature_fields")
        .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
        .filter((q) => q.eq(q.field("fieldType"), "payment"))
        .collect();

      for (const pf of paymentFields) {
        const config = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", pf._id))
          .unique();

        if (config && config.paymentStatus !== "paid") {
          throw new ConvexError({
            code: "PAYMENT_REQUIRED",
            message: "All payment fields must be completed before signing",
          });
        }
      }
    }

    // 6. Update the recipient
    const now = Date.now();
    const updateData: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    // Set appropriate timestamp
    switch (args.status) {
      case "viewed":
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "signed":
        updateData.signedAt = now;
        updateData.signatureData = args.signatureData;
        updateData.signatureType = args.signatureType;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "approved":
        updateData.approvedAt = now;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "declined":
        updateData.declinedAt = now;
        updateData.declineReason = args.declineReason;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
    }

    if (args.ipAddress) {
      updateData.ipAddress = args.ipAddress;
    }

    await ctx.db.patch(recipient._id, updateData);

    // 7. Audit trail
    const document = await ctx.db.get(recipient.documentId);
    if (document) {
      const auditAction =
        args.status === "signed" || args.status === "approved"
          ? ("recipient.signed" as const)
          : args.status === "declined"
            ? ("recipient.declined" as const)
            : args.status === "viewed"
              ? ("recipient.viewed" as const)
              : null;
      if (auditAction) {
        await logRecipientAction(ctx, {
          organizationId: document.organizationId,
          actorType: "recipient",
          actorId: recipient._id,
          action: auditAction,
          documentId: recipient.documentId,
          recipientId: recipient._id,
          newValues: { status: args.status },
          ipAddress: args.ipAddress ?? "0.0.0.0",
        });
      }
    }

    // 8. Schedule post-signature emails if recipient completed their action
    // (signed, approved, or declined - but not just viewed)
    if (isRecipientComplete(recipient.role, args.status)) {
      await ctx.scheduler.runAfter(
        0,
        internal.documents.recipient_email_action.sendPostSignatureEmails,
        {
          recipientId: recipient._id,
          documentId: recipient.documentId,
        },
      );
    }

    // 9. Publish webhook event for recipient status changes
    if (document && (args.status === "signed" || args.status === "approved")) {
      await publishWebhookEvent(ctx, {
        organizationId: document.organizationId,
        eventType: "recipient.signed",
        data: {
          document_id: recipient.documentId,
          recipient_id: recipient._id,
          recipient_email: recipient.email,
          status: args.status,
          signed_at: new Date().toISOString(),
        },
      });
    } else if (document && args.status === "declined") {
      await publishWebhookEvent(ctx, {
        organizationId: document.organizationId,
        eventType: "recipient.declined",
        data: {
          document_id: recipient.documentId,
          recipient_id: recipient._id,
          recipient_email: recipient.email,
          decline_reason: args.declineReason,
          declined_at: new Date().toISOString(),
        },
      });
    }

    return { success: true, recipientId: recipient._id };
  },
});

/**
 * Submit signature for authenticated users who are recipients
 * Used for in-app signing when the user is both authenticated and a recipient
 */
export const submitSignatureAuthenticated = authMutation({
  args: {
    documentId: v.id("documents"),
    status: recipientStatusTuple,
    signatureData: v.optional(v.string()),
    signatureType: v.optional(
      v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded")),
    ),
    declineReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get user email for recipient matching
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      throw new ConvexError("User not found or has no email");
    }

    const userEmail = user.email.toLowerCase();

    // 2. Get the document and verify it's in a signable state
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (document.status === "deleted") {
      throw new ConvexError("Document has been deleted");
    }

    // Only allow signing when document is sent or in_progress (not draft or completed)
    if (document.workflowStatus === "draft" || !document.workflowStatus) {
      throw new ConvexError("Document must be sent before signing");
    }

    if (document.workflowStatus === "completed") {
      throw new ConvexError("Cannot sign a completed document");
    }

    // 3. Find recipient by document + email match
    const recipient = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first();

    if (!recipient) {
      throw new ConvexError("You are not a recipient on this document");
    }

    // 4. Validate status transition
    // Cannot change status if already in terminal state
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      throw new ConvexError(`Cannot update status - you have already ${recipient.status}`);
    }

    // 5. Validate status change is appropriate for role
    if (args.status === "signed" && recipient.role !== "signer") {
      throw new ConvexError("Only signers can have status 'signed'");
    }
    if (args.status === "approved" && recipient.role !== "approver") {
      throw new ConvexError("Only approvers can have status 'approved'");
    }

    // 6. Validate required data
    if (args.status === "signed") {
      if (!args.signatureData || !args.signatureType) {
        throw new ConvexError("Signature data and type are required for signing");
      }
    }
    if (args.status === "declined" && !args.declineReason) {
      throw new ConvexError("Decline reason is required");
    }

    // 6b. Enforce payment completion before signing/approving
    if (args.status === "signed" || args.status === "approved") {
      const paymentFields = await ctx.db
        .query("signature_fields")
        .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
        .filter((q) => q.eq(q.field("fieldType"), "payment"))
        .collect();

      for (const pf of paymentFields) {
        const config = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", pf._id))
          .unique();

        if (config && config.paymentStatus !== "paid") {
          throw new ConvexError({
            code: "PAYMENT_REQUIRED",
            message: "All payment fields must be completed before signing",
          });
        }
      }
    }

    // 7. Update the recipient
    const now = Date.now();
    const updateData: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    // Set appropriate timestamp
    switch (args.status) {
      case "viewed":
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "signed":
        updateData.signedAt = now;
        updateData.signatureData = args.signatureData;
        updateData.signatureType = args.signatureType;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "approved":
        updateData.approvedAt = now;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
      case "declined":
        updateData.declinedAt = now;
        updateData.declineReason = args.declineReason;
        if (!recipient.viewedAt) {
          updateData.viewedAt = now;
        }
        break;
    }

    // Set IP address for audit trail
    updateData.ipAddress = "authenticated";

    await ctx.db.patch(recipient._id, updateData);

    // 8. Audit trail
    {
      const auditAction =
        args.status === "signed" || args.status === "approved"
          ? ("recipient.signed" as const)
          : args.status === "declined"
            ? ("recipient.declined" as const)
            : args.status === "viewed"
              ? ("recipient.viewed" as const)
              : null;
      if (auditAction) {
        await logRecipientAction(ctx, {
          organizationId: document.organizationId,
          actorType: "user",
          actorId: user.clerkId,
          userId: user.clerkId,
          action: auditAction,
          documentId: args.documentId,
          recipientId: recipient._id,
          newValues: { status: args.status },
          ipAddress: "web-authenticated",
        });
      }
    }

    // 9. Schedule post-signature emails if recipient completed their action
    if (isRecipientComplete(recipient.role, args.status)) {
      await ctx.scheduler.runAfter(
        0,
        internal.documents.recipient_email_action.sendPostSignatureEmails,
        {
          recipientId: recipient._id,
          documentId: args.documentId,
        },
      );
    }

    return { success: true, recipientId: recipient._id };
  },
});

/**
 * Update recipient information
 * Can only be called on draft/pending_signature documents by the owner
 * Requires documents:edit permission
 */
export const updateRecipient = permissionMutation("documents:edit")({
  args: {
    recipientId: v.id("document_recipients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(recipientRoleTuple),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new ConvexError("Recipient not found");
    }

    // 2. Verify ownership of the document
    await verifyDocumentOwnership(ctx, recipient.documentId, userId);

    // 3. Get the document
    const document = await ctx.db.get(recipient.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 4. Verify document is editable (not deleted or workflow completed)
    if (document.status === "deleted" || document.workflowStatus === "completed") {
      throw new ConvexError("Cannot edit recipients on deleted or completed documents");
    }

    // 5. Check recipient hasn't already completed their action
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      throw new ConvexError("Cannot edit recipient who has already completed their action");
    }

    // 6. Validate email if changing
    if (args.email !== undefined) {
      const newEmail = args.email.toLowerCase();
      // Check for duplicate email among other recipients
      const existingRecipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", recipient.documentId))
        .collect();

      const duplicateEmail = existingRecipients.find(
        (r) => r._id !== args.recipientId && r.email === newEmail,
      );
      if (duplicateEmail) {
        throw new ConvexError("A recipient with this email already exists");
      }
    }

    // 7. Get user for audit logging
    const user = await ctx.db.get(userId);

    // 8. Build update object
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.email !== undefined) {
      updates.email = args.email.toLowerCase();
    }
    if (args.role !== undefined) {
      updates.role = args.role;
    }
    if (args.order !== undefined) {
      updates.order = args.order;
    }

    // 9. Update the recipient
    await ctx.db.patch(args.recipientId, updates);

    // 10. Audit log
    if (user) {
      const { updatedAt: _, ...changedFields } = updates;
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "user",
        actorId: user.clerkId,
        userId: user.clerkId,
        action: "recipient.updated",
        documentId: recipient.documentId,
        recipientId: args.recipientId,
        newValues: changedFields,
        ipAddress: "web-authenticated",
      });
    }

    return { success: true };
  },
});

/**
 * Regenerate signing token for a recipient (if expired or compromised)
 * Can only be called by document owner
 * Requires documents:edit permission
 */
export const regenerateSigningToken = permissionMutation("documents:edit")({
  args: {
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the recipient
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new ConvexError("Recipient not found");
    }

    // 2. Verify ownership
    await verifyDocumentOwnership(ctx, recipient.documentId, userId);

    // 3. Check recipient status - cannot regenerate for completed recipients
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      throw new ConvexError(
        "Cannot regenerate token for recipients who have already completed their action",
      );
    }

    // 4. Generate new token with extended expiration
    const now = Date.now();
    const { token: newToken, tokenHash: newTokenHash } = await generateSigningToken();
    const newExpiration = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

    await ctx.db.patch(args.recipientId, {
      signingToken: newToken,
      tokenHash: newTokenHash,
      tokenExpiresAt: newExpiration,
      updatedAt: now,
    });

    return { success: true, newToken };
  },
});

/**
 * Record ESIGN Act consent for a recipient.
 * Must be called before the recipient can sign any fields.
 * This is a public mutation (no auth required) since recipients
 * access via signing token from email links.
 */
export const recordEsignConsent = mutation({
  args: {
    signingToken: v.string(),
    ipAddress: v.optional(v.string()),
    consentVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }

    // Record consent
    const now = Date.now();
    await ctx.db.patch(recipient._id, {
      esignConsentAt: now,
      esignConsentIp: args.ipAddress ?? "unknown",
      esignConsentVersion: args.consentVersion ?? "1.0",
      updatedAt: now,
    });

    // Log to audit trail
    const document = await ctx.db.get(recipient.documentId);
    if (document) {
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "recipient",
        actorId: recipient._id,
        action: "recipient.esign_consent",
        documentId: recipient.documentId,
        recipientId: recipient._id,
        newValues: {
          consentVersion: args.consentVersion ?? "1.0",
          consentAt: now,
        },
        ipAddress: args.ipAddress ?? "unknown",
        userAgent: "signing-page",
      });
    }

    return { success: true, consentAt: now };
  },
});

/**
 * Log when a recipient opts out of electronic signing (ESIGN Act compliance).
 * Records the opt-out in the audit trail for legal records.
 */
export const recordEsignOptOut = mutation({
  args: {
    signingToken: v.string(),
    ipAddress: v.optional(v.string()),
    method: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }

    // Log opt-out to audit trail
    const document = await ctx.db.get(recipient.documentId);
    if (document) {
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "recipient",
        actorId: recipient._id,
        action: "recipient.esign_opt_out",
        documentId: recipient.documentId,
        recipientId: recipient._id,
        newValues: {
          method: args.method ?? "paper_copy_request",
        },
        ipAddress: args.ipAddress ?? "unknown",
        userAgent: "signing-page",
      });
    }

    return { success: true };
  },
});
