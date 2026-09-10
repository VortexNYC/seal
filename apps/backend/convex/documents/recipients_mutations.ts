/**
 * Document recipients mutations for Seal
 */

import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "../_generated/server";
import { logActionRequired, logRecipientAction } from "../audit_logs/helpers";
import { authMutation, permissionMutation } from "../auth";
import { generateStringHash } from "../crypto/helpers";
import {
  isRecipientComplete,
  recipientRoleTuple,
  recipientStatusTuple,
} from "../schemas/document_recipients";
import {
  type DocumentWorkflowStatus,
  isValidWorkflowTransition,
} from "../schemas/document_workflow_status";
import { publishWebhookEvent } from "../webhooks/publish";
import {
  findRecipientByToken,
  isRecipientGroupActive,
  verifyDocumentOwnership,
} from "./recipient_helpers";

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
  const token = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const tokenHash = await generateStringHash(token);
  return { token, tokenHash };
}

type RecipientDbCtx = Pick<MutationCtx, "db">;

type RecipientStatusChangeArgs = {
  status: Doc<"document_recipients">["status"];
  signatureData?: string;
  signatureType?: "drawn" | "typed" | "uploaded";
  declineReason?: string;
  ipAddress?: string;
};

type RecipientStatusUpdate = {
  status: Doc<"document_recipients">["status"];
  updatedAt: number;
  viewedAt?: number;
  signedAt?: number;
  signatureData?: string;
  signatureType?: "drawn" | "typed" | "uploaded";
  approvedAt?: number;
  declinedAt?: number;
  declineReason?: string;
  ipAddress?: string;
};

function ensureRecipientCanUpdateStatus(
  recipient: Doc<"document_recipients">,
  args: RecipientStatusChangeArgs,
  terminalMessage: string
): void {
  if (
    recipient.status === "signed" ||
    recipient.status === "approved" ||
    recipient.status === "declined"
  ) {
    throw new ConvexError(terminalMessage);
  }

  if (args.status === "signed" && recipient.role !== "signer") {
    throw new ConvexError("Only signers can have status 'signed'");
  }
  if (args.status === "approved" && recipient.role !== "approver") {
    throw new ConvexError("Only approvers can have status 'approved'");
  }
  if (
    args.status === "signed" &&
    (!args.signatureData || !args.signatureType)
  ) {
    throw new ConvexError("Signature data and type are required for signing");
  }
  if (args.status === "declined" && !args.declineReason) {
    throw new ConvexError("Decline reason is required");
  }
}

async function ensureRecipientPaymentsAreComplete(
  ctx: RecipientDbCtx,
  recipient: Doc<"document_recipients">,
  status: RecipientStatusChangeArgs["status"]
): Promise<void> {
  if (status !== "signed" && status !== "approved") {
    return;
  }

  const paymentFields = [];
  for await (const _row of ctx.db
    .query("signature_fields")
    .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))) {
    if (!(_row.fieldType === "payment")) {
      continue;
    }
    paymentFields.push(_row);
  }

  for (const paymentField of paymentFields) {
    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_field", (q) => q.eq("fieldId", paymentField._id))
      .unique();

    if (config && config.paymentStatus !== "paid") {
      throw new ConvexError({
        code: "PAYMENT_REQUIRED",
        message: "All payment fields must be completed before signing",
      });
    }
  }
}

async function ensureSequentialRecipientIsActive(
  ctx: RecipientDbCtx,
  recipient: Doc<"document_recipients">,
  documentId: Doc<"documents">["_id"],
  signingMode: Doc<"documents">["signingMode"] | undefined,
  status: RecipientStatusChangeArgs["status"]
): Promise<void> {
  if (signingMode !== "sequential" || status === "viewed") {
    return;
  }

  const allRecipients = [];
  for await (const _row of ctx.db
    .query("document_recipients")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))) {
    allRecipients.push(_row);
  }

  if (!isRecipientGroupActive(recipient, allRecipients)) {
    throw new ConvexError(
      "Previous recipients must complete their action first"
    );
  }
}

function buildRecipientStatusUpdate(
  recipient: Doc<"document_recipients">,
  args: RecipientStatusChangeArgs,
  ipAddress?: string
): { updateData: RecipientStatusUpdate; viewedAt?: number } {
  const now = Date.now();
  const updateData: RecipientStatusUpdate = {
    status: args.status,
    updatedAt: now,
  };

  if (ipAddress) {
    updateData.ipAddress = ipAddress;
  }

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

  return { updateData, viewedAt: updateData.viewedAt };
}

function getRecipientAuditAction(status: RecipientStatusChangeArgs["status"]) {
  if (status === "signed" || status === "approved") {
    return "recipient.signed" as const;
  }
  if (status === "declined") {
    return "recipient.declined" as const;
  }
  if (status === "viewed") {
    return "recipient.viewed" as const;
  }
  return null;
}

export async function maybeStartPostSignatureWorkflow(
  ctx: Pick<MutationCtx, "scheduler">,
  recipient: Doc<"document_recipients">,
  status: RecipientStatusChangeArgs["status"]
): Promise<void> {
  if (!isRecipientComplete(recipient.role, status)) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.documents.recipients_mutations.markDocumentAsCompleted,
    {
      documentId: recipient.documentId,
    }
  );
}

export const markDocumentAsCompleted = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.workflowStatus === "completed") {
      return { success: false };
    }

    const allRecipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    if (!allRecipients.every((r) => isRecipientComplete(r.role, r.status))) {
      return { success: false };
    }

    const now = Date.now();
    const SEVEN_YEARS_MS = 7 * 365.25 * 24 * 60 * 60 * 1000;
    await ctx.db.patch("documents", document._id, {
      workflowStatus: "completed",
      completedAt: now,
      updatedAt: now,
      retainUntil: now + SEVEN_YEARS_MS,
      qrToken: nanoid(24),
      qrTokenGeneratedAt: now,
    });

    await logActionRequired(ctx, {
      organizationId: document.organizationId,
      actorType: "system",
      actorId: "workflow:document_completion",
      action: "document.completed",
      resourceType: "document",
      resourceId: document._id,
      documentId: document._id,
      oldValues: { workflowStatus: document.workflowStatus },
      newValues: { workflowStatus: "completed", completedAt: now },
      metadata: { source: "documentCompletionWorkflow" },
      ipAddress: "system",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.documents.certificate_of_completion.generateCertificate,
      {
        documentId: document._id,
      }
    );

    return { success: true };
  },
});

async function maybePublishRecipientWebhook(
  ctx: MutationCtx,
  document: Doc<"documents"> | null,
  recipient: Doc<"document_recipients">,
  args: RecipientStatusChangeArgs
): Promise<void> {
  if (!document) {
    return;
  }

  if (args.status === "signed" || args.status === "approved") {
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
    return;
  }

  if (args.status === "declined") {
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
}

function getDocumentWorkflowStatus(
  document: Doc<"documents">
): DocumentWorkflowStatus {
  return document.workflowStatus ?? "draft";
}

async function maybeMarkDocumentDeclined(
  ctx: Pick<MutationCtx, "db">,
  document: Doc<"documents"> | null,
  recipient: Doc<"document_recipients">,
  args: RecipientStatusChangeArgs
): Promise<void> {
  if (
    args.status !== "declined" ||
    !document ||
    document.status === "deleted"
  ) {
    return;
  }

  const currentStatus = getDocumentWorkflowStatus(document);
  if (currentStatus === "declined") {
    return;
  }

  if (!isValidWorkflowTransition(currentStatus, "declined")) {
    throw new ConvexError(
      `Cannot decline a document in ${currentStatus} status`
    );
  }

  const declinedAt = Date.now();
  await ctx.db.patch("documents", document._id, {
    workflowStatus: "declined",
    declinedAt,
    updatedAt: declinedAt,
  });

  await publishWebhookEvent(ctx, {
    organizationId: document.organizationId,
    eventType: "document.declined",
    data: {
      document_id: document._id,
      name: document.name,
      recipient_id: recipient._id,
      recipient_email: recipient.email,
      decline_reason: args.declineReason,
      declined_at: new Date(declinedAt).toISOString(),
    },
  });
}

async function loadTokenRecipientStatusContext(
  ctx: RecipientDbCtx,
  signingToken: string
): Promise<{
  recipient: Doc<"document_recipients">;
  document: Doc<"documents"> | null;
}> {
  const recipient = await findRecipientByToken(ctx, signingToken);
  if (!recipient) {
    throw new ConvexError("Invalid signing token");
  }
  if (recipient.tokenExpiresAt < Date.now()) {
    throw new ConvexError("Signing token has expired");
  }

  const document = await ctx.db.get("documents", recipient.documentId);
  return { recipient, document };
}

async function applyRecipientStatusChange(
  ctx: MutationCtx,
  recipient: Doc<"document_recipients">,
  document: Doc<"documents"> | null,
  args: RecipientStatusChangeArgs
): Promise<number | undefined> {
  ensureRecipientCanUpdateStatus(
    recipient,
    args,
    `Cannot update status - recipient has already ${recipient.status}`
  );
  await ensureRecipientPaymentsAreComplete(ctx, recipient, args.status);
  await ensureSequentialRecipientIsActive(
    ctx,
    recipient,
    recipient.documentId,
    document?.signingMode,
    args.status
  );

  const { updateData, viewedAt } = buildRecipientStatusUpdate(
    recipient,
    args,
    args.ipAddress ?? "0.0.0.0"
  );
  await ctx.db.patch("document_recipients", recipient._id, updateData);
  return viewedAt;
}

async function logRecipientStatusChange(
  ctx: MutationCtx,
  document: Doc<"documents"> | null,
  recipient: Doc<"document_recipients">,
  args: RecipientStatusChangeArgs
): Promise<void> {
  if (!document) {
    return;
  }

  const auditAction = getRecipientAuditAction(args.status);
  if (!auditAction) {
    return;
  }

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
        isPlaceholder: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Verify ownership
    await verifyDocumentOwnership(ctx, args.documentId, userId);

    // 2. Get the document
    const document = await ctx.db.get("documents", args.documentId);
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
    const user = await ctx.db.get("users", userId);

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
        isPlaceholder: recipient.isPlaceholder,
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
          actorId: user.authSubject,
          userId: user.authSubject,
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
    const recipient = await ctx.db.get("document_recipients", args.recipientId);
    if (!recipient) {
      throw new ConvexError("Recipient not found");
    }

    // 2. Verify ownership of the document
    await verifyDocumentOwnership(ctx, recipient.documentId, userId);

    // 3. Get the document
    const document = await ctx.db.get("documents", recipient.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 4. Verify document is in draft status
    if (document.status === "deleted") {
      throw new ConvexError("Cannot remove recipients from deleted document");
    }

    // 5. Get user for audit logging
    const user = await ctx.db.get("users", userId);

    // 6. Find and delete all signature fields assigned to this recipient
    const fieldsToDelete = [];
    for await (const _row of ctx.db
      .query("signature_fields")
      .withIndex("by_recipient", (q) =>
        q.eq("recipientId", args.recipientId)
      )) {
      fieldsToDelete.push(_row);
    }

    for (const field of fieldsToDelete) {
      // Cascade-delete payment config if this is a payment field
      if (field.fieldType === "payment") {
        const paymentConfig = await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", field._id))
          .unique();
        if (paymentConfig) {
          await ctx.db.delete("payment_field_configs", paymentConfig._id);
        }
      }
      await ctx.db.delete("signature_fields", field._id);
    }

    // 7. Audit log before deletion (capture recipient info)
    if (user) {
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "user",
        actorId: user.authSubject,
        userId: user.authSubject,
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
    await ctx.db.delete("document_recipients", args.recipientId);

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
      v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded"))
    ),
    declineReason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { recipient } = await loadTokenRecipientStatusContext(
      ctx,
      args.signingToken
    );
    ensureRecipientCanUpdateStatus(
      recipient,
      args,
      `Cannot update status - recipient has already ${recipient.status}`
    );
    const { updateData } = buildRecipientStatusUpdate(
      recipient,
      args,
      args.ipAddress
    );
    await ctx.db.patch("document_recipients", recipient._id, updateData);
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
      v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded"))
    ),
    declineReason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { recipient, document } = await loadTokenRecipientStatusContext(
      ctx,
      args.signingToken
    );
    await applyRecipientStatusChange(ctx, recipient, document, args);
    await maybeMarkDocumentDeclined(ctx, document, recipient, args);
    await logRecipientStatusChange(ctx, document, recipient, args);
    await maybeStartPostSignatureWorkflow(ctx, recipient, args.status);
    await maybePublishRecipientWebhook(ctx, document, recipient, args);

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
      v.union(v.literal("drawn"), v.literal("typed"), v.literal("uploaded"))
    ),
    declineReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;
    const user = await ctx.db.get("users", userId);
    if (!user || !user.email) {
      throw new ConvexError("User not found or has no email");
    }

    const userEmail = user.email.toLowerCase();
    const document = await ctx.db.get("documents", args.documentId);
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

    let recipient = null;
    for await (const row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      if (row.email === userEmail) {
        recipient = row;
        break;
      }
    }

    if (!recipient) {
      throw new ConvexError("You are not a recipient on this document");
    }
    ensureRecipientCanUpdateStatus(
      recipient,
      args,
      `Cannot update status - you have already ${recipient.status}`
    );
    await ensureRecipientPaymentsAreComplete(ctx, recipient, args.status);
    await ensureSequentialRecipientIsActive(
      ctx,
      recipient,
      args.documentId,
      document.signingMode,
      args.status
    );

    const { updateData } = buildRecipientStatusUpdate(
      recipient,
      args,
      "authenticated"
    );

    await ctx.db.patch("document_recipients", recipient._id, updateData);
    await maybeMarkDocumentDeclined(ctx, document, recipient, args);

    const auditAction = getRecipientAuditAction(args.status);
    if (auditAction) {
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "user",
        actorId: user.authSubject,
        userId: user.authSubject,
        action: auditAction,
        documentId: args.documentId,
        recipientId: recipient._id,
        newValues: { status: args.status },
        ipAddress: "web-authenticated",
      });
    }

    await maybeStartPostSignatureWorkflow(ctx, recipient, args.status);

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
    const recipient = await ctx.db.get("document_recipients", args.recipientId);
    if (!recipient) {
      throw new ConvexError("Recipient not found");
    }

    // 2. Verify ownership of the document
    await verifyDocumentOwnership(ctx, recipient.documentId, userId);

    // 3. Get the document
    const document = await ctx.db.get("documents", recipient.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 4. Verify document is editable (not deleted or workflow completed)
    if (
      document.status === "deleted" ||
      document.workflowStatus === "completed"
    ) {
      throw new ConvexError(
        "Cannot edit recipients on deleted or completed documents"
      );
    }

    // 5. Check recipient hasn't already completed their action
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      throw new ConvexError(
        "Cannot edit recipient who has already completed their action"
      );
    }

    // 6. Validate email if changing
    if (args.email !== undefined) {
      const newEmail = args.email.toLowerCase();
      // Check for duplicate email among other recipients
      const existingRecipients = [];
      for await (const _row of ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) =>
          q.eq("documentId", recipient.documentId)
        )) {
        existingRecipients.push(_row);
      }

      const duplicateEmail = existingRecipients.find(
        (r) => r._id !== args.recipientId && r.email === newEmail
      );
      if (duplicateEmail) {
        throw new ConvexError("A recipient with this email already exists");
      }
    }

    // 7. Get user for audit logging
    const user = await ctx.db.get("users", userId);

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
    await ctx.db.patch("document_recipients", args.recipientId, updates);

    // 10. Audit log
    if (user) {
      const { updatedAt: _, ...changedFields } = updates;
      await logRecipientAction(ctx, {
        organizationId: document.organizationId,
        actorType: "user",
        actorId: user.authSubject,
        userId: user.authSubject,
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
    const recipient = await ctx.db.get("document_recipients", args.recipientId);
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
        "Cannot regenerate token for recipients who have already completed their action"
      );
    }

    // 4. Generate new token with extended expiration
    const now = Date.now();
    const { token: newToken, tokenHash: newTokenHash } =
      await generateSigningToken();
    const newExpiration = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

    await ctx.db.patch("document_recipients", args.recipientId, {
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
    await ctx.db.patch("document_recipients", recipient._id, {
      esignConsentAt: now,
      esignConsentIp: args.ipAddress ?? "unknown",
      esignConsentVersion: args.consentVersion ?? "1.0",
      updatedAt: now,
    });

    // Log to audit trail
    const document = await ctx.db.get("documents", recipient.documentId);
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
    const document = await ctx.db.get("documents", recipient.documentId);
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

/**
 * Internal mutation: mark a signer as awaiting dictation.
 * Called by recipient_email_action when the next sequential recipient is a placeholder.
 */
export const setAwaitingDictation = internalMutation({
  args: {
    recipientId: v.id("document_recipients"),
    placeholderRecipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch("document_recipients", args.recipientId, {
      awaitingDictation: true,
      updatedAt: now,
    });
  },
});

/**
 * Public mutation: a signer designates the next recipient in the signing chain.
 * Called from the signing page after a signer completes their signature on a document
 * with allowDictateNextSigner === true and the next slot is a placeholder.
 */
export const dictateNextRecipient = mutation({
  args: {
    signingToken: v.string(),
    nextName: v.string(),
    nextEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Resolve the calling recipient via token
    const recipient = await findRecipientByToken(ctx, args.signingToken);
    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    // 2. Must have just signed and be awaiting dictation
    if (recipient.status !== "signed" && recipient.status !== "approved") {
      throw new ConvexError(
        "Only completed signers can designate the next recipient"
      );
    }
    if (!recipient.awaitingDictation) {
      throw new ConvexError("No dictation required for this recipient");
    }

    // 3. Fetch document and verify it has dictation enabled
    const document = await ctx.db.get("documents", recipient.documentId);
    if (!document) throw new ConvexError("Document not found");
    if (!document.allowDictateNextSigner) {
      throw new ConvexError("This document does not support dictation");
    }

    // 4. Validate the provided email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.nextEmail)) {
      throw new ConvexError("Invalid email address");
    }

    // 5. Find the placeholder recipient in the next signing group
    const allRecipients = [];
    for await (const _row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) =>
        q.eq("documentId", recipient.documentId)
      )) {
      allRecipients.push(_row);
    }

    const myOrder = recipient.order ?? 0;
    const placeholder = allRecipients
      .filter((r) => (r.order ?? 0) > myOrder && r.isPlaceholder)
      .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

    if (!placeholder) {
      throw new ConvexError(
        "No placeholder recipient found in the next signing group"
      );
    }

    // 6. Generate a new signing token for the newly-identified recipient
    const { token, tokenHash } = await generateSigningToken();
    const now = Date.now();
    const tokenExpiration = now + 30 * 24 * 60 * 60 * 1000;

    // 7. Update the placeholder with real identity
    await ctx.db.patch("document_recipients", placeholder._id, {
      name: args.nextName.trim(),
      email: args.nextEmail.trim().toLowerCase(),
      isPlaceholder: false,
      dictatedBy: recipient._id,
      dictatedAt: now,
      signingToken: token,
      tokenHash,
      tokenExpiresAt: tokenExpiration,
      updatedAt: now,
    });

    // 8. Clear awaitingDictation on the dictating signer
    await ctx.db.patch("document_recipients", recipient._id, {
      awaitingDictation: false,
      updatedAt: now,
    });

    // 9. Audit log
    await logRecipientAction(ctx, {
      organizationId: document.organizationId,
      actorType: "recipient",
      actorId: recipient._id,
      action: "recipient.dictated",
      documentId: recipient.documentId,
      recipientId: placeholder._id,
      newValues: { name: args.nextName, email: args.nextEmail },
      ipAddress: "0.0.0.0",
    });

    return { success: true };
  },
});
