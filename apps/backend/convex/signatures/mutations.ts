import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { logRecipientAction, logSignatureAction } from "../audit_logs/helpers";
import { authMutation } from "../auth";
import { encryptSignatureData } from "../crypto/encryption";
import {
  generateSignatureHash,
  generateSignatureImageHash,
} from "../crypto/helpers";

/** Get the signature encryption key from environment (undefined in dev = no encryption). */
function getEncryptionKey(): string | undefined {
  return process.env.SIGNATURE_ENCRYPTION_KEY;
}
import { findRecipientByToken } from "../documents/recipient_helpers";
import { maybeStartPostSignatureWorkflow } from "../documents/recipients_mutations";
import { authenticationMethodTuple } from "../schemas/recipients";
import { publishWebhookEvent } from "../webhooks/publish";
import {
  validateAgainstRules,
  validateSignature,
  verifyDocumentIntegrityForSigning,
} from "./helpers";

// Signature method type
const signatureMethodTuple = v.union(
  v.literal("draw"),
  v.literal("type"),
  v.literal("upload")
);

interface SignatureSaveInput {
  fieldId: Id<"signature_fields">;
  value?: string;
  signatureImageUrl?: string;
  signatureMethod?: "draw" | "type" | "upload";
  ipAddress: string;
  userAgent: string;
}

interface PreparedSignatureContext {
  recipient: Doc<"document_recipients">;
  field: Doc<"signature_fields">;
  document: Doc<"documents">;
  existingSignature: Doc<"signatures"> | null;
}

interface ComputedSignaturePayload {
  documentHash: string;
  encryptedImageUrl: string | undefined;
  signatureHash: string;
  signatureImageHash: string | undefined;
  signedAt: number;
}

type SignatureDbCtx = Pick<MutationCtx, "db">;

function ensureValueMeetsRules(
  field: Doc<"signature_fields">,
  value?: string
): void {
  if (!value || !field.validationRules) {
    return;
  }

  const rulesValidation = validateAgainstRules(value, field.validationRules);
  if (!rulesValidation.valid) {
    throw new Error(
      rulesValidation.error || "Value does not meet validation requirements"
    );
  }
}

function ensureSignatureInputIsValid(
  field: Doc<"signature_fields">,
  input: Pick<SignatureSaveInput, "value" | "signatureImageUrl">
): void {
  const signatureValidation = validateSignature(
    field.fieldType,
    input.value,
    input.signatureImageUrl
  );
  if (!signatureValidation.valid) {
    throw new Error(signatureValidation.error || "Invalid field value");
  }

  ensureValueMeetsRules(field, input.value);
}

async function computeSignaturePayload(
  recipientId: Id<"document_recipients">,
  input: SignatureSaveInput,
  documentHash: string
): Promise<ComputedSignaturePayload> {
  const signedAt = Date.now();
  const signatureData = input.value || input.signatureImageUrl || "";
  const signatureHash = await generateSignatureHash(
    signatureData,
    recipientId,
    input.fieldId,
    documentHash,
    signedAt
  );
  const signatureImageHash = await generateSignatureImageHash(
    input.signatureImageUrl
  );
  const encryptedImageUrl = await encryptSignatureData(
    input.signatureImageUrl,
    getEncryptionKey()
  );

  return {
    documentHash,
    encryptedImageUrl,
    signatureHash,
    signatureImageHash,
    signedAt,
  };
}

async function upsertSignatureRecord(
  ctx: SignatureDbCtx,
  signatureContext: PreparedSignatureContext,
  input: SignatureSaveInput,
  payload: ComputedSignaturePayload
): Promise<{ signatureId: Id<"signatures">; isUpdate: boolean }> {
  const timestamp = Date.now();
  const { recipient, field, document, existingSignature } = signatureContext;

  if (existingSignature) {
    await ctx.db.patch(existingSignature._id, {
      ...(input.value !== undefined && { value: input.value }),
      ...(input.signatureImageUrl !== undefined && {
        signatureImageUrl: payload.encryptedImageUrl,
      }),
      signedAt: payload.signedAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      signatureHash: payload.signatureHash,
      signatureImageHash: payload.signatureImageHash,
      documentHashAtSigning: payload.documentHash,
      signatureMethod: input.signatureMethod,
      updatedAt: timestamp,
    });

    await logSignatureAction(ctx, {
      organizationId: document.organizationId,
      recipientId: recipient._id,
      action: "signature.updated",
      signatureId: existingSignature._id,
      fieldId: field._id,
      documentId: field.documentId,
      oldValues: {
        value: existingSignature.value,
      },
      newValues: {
        value: input.value,
        signatureHash: payload.signatureHash,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return { signatureId: existingSignature._id, isUpdate: true };
  }

  const signatureId = await ctx.db.insert("signatures", {
    fieldId: field._id,
    recipientId: recipient._id,
    documentId: field.documentId,
    value: input.value,
    signatureImageUrl: payload.encryptedImageUrl,
    signatureHash: payload.signatureHash,
    signatureImageHash: payload.signatureImageHash,
    documentHashAtSigning: payload.documentHash,
    signatureMethod: input.signatureMethod,
    signedAt: payload.signedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await logSignatureAction(ctx, {
    organizationId: document.organizationId,
    recipientId: recipient._id,
    action: "signature.created",
    signatureId,
    fieldId: field._id,
    documentId: field.documentId,
    newValues: {
      value: input.value,
      signatureHash: payload.signatureHash,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return { signatureId, isUpdate: false };
}

async function autoSubmitMainSignature(
  ctx: MutationCtx,
  recipient: Doc<"document_recipients">,
  document: Doc<"documents">,
  field: Doc<"signature_fields">,
  signatureImageUrl: string | undefined,
  ipAddress: string
): Promise<void> {
  if (field.isMainSignature !== true || field.fieldType !== "signature") {
    return;
  }

  const status =
    recipient.role === "signer"
      ? "signed"
      : recipient.role === "approver"
        ? "approved"
        : "viewed";

  await ctx.db.patch(recipient._id, {
    status,
    signatureData: signatureImageUrl,
    signatureType: "drawn",
    signedAt: status === "signed" ? Date.now() : undefined,
    approvedAt: status === "approved" ? Date.now() : undefined,
  });

  if (status !== "signed" && status !== "approved") {
    return;
  }

  // Audit trail: token-based signers reach terminal status through this path
  // (rather than an explicit submitRecipientSignature(signed) call), so the
  // status-change audit entry has to be written here too. Otherwise the
  // recipient.signed event is missing from the trail and downstream tooling
  // (dashboard activity, compliance exports) can't see when this recipient
  // actually completed. The audit table only enumerates `recipient.signed`
  // for terminal actions on this path; "approved" recipients are tracked via
  // their own webhook + status change audit elsewhere.
  if (status === "signed") {
    await logRecipientAction(ctx, {
      organizationId: document.organizationId,
      actorType: "recipient",
      actorId: recipient._id,
      recipientId: recipient._id,
      action: "recipient.signed",
      documentId: field.documentId,
      newValues: { status },
      ipAddress,
    });
  }

  // Kick off the durable post-signature workflow (sendSignerConfirmation →
  // documentCompletionWorkflow → markDocumentAsCompleted + cert generation).
  // Without this the recipient is marked complete but the doc never finalizes
  // — completion email never fires, certificate never generates, and the doc
  // stays in workflowStatus="sent" indefinitely from the sender's perspective.
  await maybeStartPostSignatureWorkflow(ctx, recipient, status);

  await publishWebhookEvent(ctx, {
    organizationId: document.organizationId,
    eventType: "recipient.signed",
    data: {
      document_id: field.documentId,
      recipient_id: recipient._id,
      recipient_email: recipient.email,
      status,
      signed_at: new Date().toISOString(),
    },
  });
}

async function prepareTokenSignatureSave(
  ctx: SignatureDbCtx,
  signingToken: string,
  input: Pick<SignatureSaveInput, "fieldId" | "value" | "signatureImageUrl">
): Promise<PreparedSignatureContext> {
  const recipient = await findRecipientByToken(ctx, signingToken);
  if (!recipient) {
    throw new Error("Invalid signing token");
  }

  if (recipient.tokenExpiresAt < Date.now()) {
    throw new Error("Signing token has expired");
  }

  const field = await ctx.db.get(input.fieldId);
  if (!field) {
    throw new Error("Field not found");
  }
  if (field.recipientId !== recipient._id) {
    throw new Error("This field is not assigned to you");
  }
  if (field.documentId !== recipient.documentId) {
    throw new Error("Field does not belong to this document");
  }

  const document = await ctx.db.get(field.documentId);
  if (!document) {
    throw new Error("Document not found");
  }
  if (document.workflowStatus === "completed") {
    throw new Error("Cannot modify fields on completed document");
  }

  await verifyDocumentIntegrityForSigning(ctx, document);
  ensureSignatureInputIsValid(field, input);

  const existingSignature = await ctx.db
    .query("signatures")
    .withIndex("by_field", (q) => q.eq("fieldId", input.fieldId))
    .first();

  return { recipient, field, document, existingSignature };
}

async function prepareAuthenticatedSignatureSave(
  ctx: SignatureDbCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
  input: Pick<SignatureSaveInput, "fieldId" | "value" | "signatureImageUrl">
): Promise<PreparedSignatureContext> {
  const user = await ctx.db.get(userId);
  if (!user || !user.email) {
    throw new Error("User not found or has no email");
  }

  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new Error("Document not found");
  }
  if (document.status === "deleted") {
    throw new Error("Document has been deleted");
  }
  if (document.workflowStatus === "draft" || !document.workflowStatus) {
    throw new Error("Document must be sent before signing");
  }
  if (document.workflowStatus === "completed") {
    throw new Error("Cannot modify fields on completed document");
  }

  await verifyDocumentIntegrityForSigning(ctx, document);

  const recipient = await ctx.db
    .query("document_recipients")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .filter((q) => q.eq(q.field("email"), user.email.toLowerCase()))
    .first();

  if (!recipient) {
    throw new Error("You are not a recipient on this document");
  }

  const field = await ctx.db.get(input.fieldId);
  if (!field) {
    throw new Error("Field not found");
  }
  if (field.recipientId !== recipient._id) {
    throw new Error("This field is not assigned to you");
  }
  if (field.documentId !== documentId) {
    throw new Error("Field does not belong to this document");
  }

  ensureSignatureInputIsValid(field, input);

  const existingSignature = await ctx.db
    .query("signatures")
    .withIndex("by_field", (q) => q.eq("fieldId", input.fieldId))
    .first();

  return { recipient, field, document, existingSignature };
}

/**
 * Signature Mutations
 *
 * Create, update, and delete signatures for document fields.
 *
 * SEA-31: Database Schemas - Signatures CRUD Operations
 */

/**
 * Create a new signature for a field
 * This is called when a recipient signs a field
 */
export const createSignature = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    recipientId: v.id("document_recipients"),
    value: v.optional(v.string()), // For text/date/checkbox fields
    signatureImageUrl: v.optional(v.string()), // For signature fields
    ipAddress: v.string(),
    userAgent: v.string(),
    authenticationData: v.optional(
      v.object({
        method: authenticationMethodTuple,
        verified: v.boolean(),
        verifiedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get the field being signed
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Verify the recipient is assigned to this field
    if (field.recipientId !== args.recipientId) {
      throw new Error("Recipient is not assigned to this field");
    }

    // Get document
    const document = await ctx.db.get(field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document integrity before signing
    await verifyDocumentIntegrityForSigning(ctx, document);

    // Validate signature data based on field type
    const signatureValidation = validateSignature(
      field.fieldType,
      args.value,
      args.signatureImageUrl
    );
    if (!signatureValidation.valid) {
      throw new Error(signatureValidation.error);
    }

    // Validate against field validation rules
    if (args.value) {
      const rulesValidation = validateAgainstRules(
        args.value,
        field.validationRules
      );
      if (!rulesValidation.valid) {
        throw new Error(rulesValidation.error);
      }
    }

    // Check if signature already exists
    const existingSignature = await ctx.db
      .query("signatures")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .first();

    if (existingSignature) {
      throw new Error("Field already has a signature");
    }

    // Compute signature image hash for reuse detection (hash raw data before encryption)
    const signatureImageHash = await generateSignatureImageHash(
      args.signatureImageUrl
    );

    // Encrypt signature image data before storage
    const encKey = getEncryptionKey();
    const encryptedImageUrl = await encryptSignatureData(
      args.signatureImageUrl,
      encKey
    );

    // Create signature
    const signatureId = await ctx.db.insert("signatures", {
      fieldId: args.fieldId,
      recipientId: args.recipientId,
      documentId: field.documentId,
      value: args.value,
      signatureImageUrl: encryptedImageUrl,
      signatureImageHash,
      signedAt: Date.now(),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      authenticationData: args.authenticationData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Log action to audit trail
    await logSignatureAction(ctx, {
      organizationId: document.organizationId,
      recipientId: args.recipientId,
      action: "signature.created",
      signatureId,
      fieldId: args.fieldId,
      documentId: field.documentId,
      newValues: {
        value: args.value,
        signatureImageUrl: args.signatureImageUrl,
      },
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    return signatureId;
  },
});

/**
 * Update an existing signature
 * This allows recipients to change their signature before final submission
 */
export const updateSignature = mutation({
  args: {
    signatureId: v.id("signatures"),
    value: v.optional(v.string()),
    signatureImageUrl: v.optional(v.string()),
    ipAddress: v.string(),
    userAgent: v.string(),
  },
  handler: async (ctx, args) => {
    // Get existing signature
    const signature = await ctx.db.get(args.signatureId);
    if (!signature) {
      throw new Error("Signature not found");
    }

    // Get the field
    const field = await ctx.db.get(signature.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // Get document
    const document = await ctx.db.get(signature.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Check if document is still editable
    if (document.workflowStatus === "completed") {
      throw new Error("Cannot update signature on completed document");
    }

    // Validate new signature data
    const newValue = args.value ?? signature.value;
    const newImageUrl = args.signatureImageUrl ?? signature.signatureImageUrl;

    const signatureValidation = validateSignature(
      field.fieldType,
      newValue,
      newImageUrl
    );
    if (!signatureValidation.valid) {
      throw new Error(signatureValidation.error);
    }

    // Validate against field validation rules
    if (newValue) {
      const rulesValidation = validateAgainstRules(
        newValue,
        field.validationRules
      );
      if (!rulesValidation.valid) {
        throw new Error(rulesValidation.error);
      }
    }

    // Store old values for audit
    const oldValues = {
      value: signature.value,
      signatureImageUrl: signature.signatureImageUrl,
    };

    // Compute updated image hash for reuse detection (hash raw data before encryption)
    const updatedImageHash = await generateSignatureImageHash(
      args.signatureImageUrl ?? signature.signatureImageUrl
    );

    // Encrypt signature image data before storage
    const encKey = getEncryptionKey();
    const encryptedImageUrl = args.signatureImageUrl
      ? await encryptSignatureData(args.signatureImageUrl, encKey)
      : undefined;

    // Update signature
    await ctx.db.patch(args.signatureId, {
      ...(args.value !== undefined && { value: args.value }),
      ...(encryptedImageUrl !== undefined && {
        signatureImageUrl: encryptedImageUrl,
      }),
      signatureImageHash: updatedImageHash,
      signedAt: Date.now(), // Update timestamp
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      updatedAt: Date.now(),
    });

    // Log action to audit trail
    await logSignatureAction(ctx, {
      organizationId: document.organizationId,
      recipientId: signature.recipientId,
      action: "signature.updated",
      signatureId: args.signatureId,
      fieldId: signature.fieldId,
      documentId: signature.documentId,
      oldValues,
      newValues: {
        value: args.value,
        signatureImageUrl: args.signatureImageUrl,
      },
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    return args.signatureId;
  },
});

/**
 * Delete a signature
 * Only allowed by admins or before document is sent
 */
export const deleteSignature = mutation({
  args: {
    signatureId: v.id("signatures"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get existing signature
    const signature = await ctx.db.get(args.signatureId);
    if (!signature) {
      throw new Error("Signature not found");
    }

    // Get document
    const document = await ctx.db.get(signature.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Check if document allows signature deletion
    if (document.workflowStatus === "completed") {
      throw new Error("Cannot delete signature from completed document");
    }

    // Store signature data for audit
    const oldValues = {
      value: signature.value,
      signatureImageUrl: signature.signatureImageUrl,
      signedAt: signature.signedAt,
    };

    // Delete signature
    await ctx.db.delete(args.signatureId);

    // Log action to audit trail
    await logSignatureAction(ctx, {
      organizationId: document.organizationId,
      recipientId: signature.recipientId,
      action: "signature.updated", // Use updated as there's no deleted action
      signatureId: args.signatureId,
      fieldId: signature.fieldId,
      documentId: signature.documentId,
      oldValues,
      ipAddress: args.ipAddress ?? "web-authenticated",
      userAgent: args.userAgent ?? "web",
    });

    return { success: true };
  },
});

/**
 * Save or update a field value using signing token (unauthenticated)
 * Used on the signing page to allow recipients to fill fields
 *
 * SEA-108: Now includes cryptographic signature hash for verification
 */
export const saveFieldValue = mutation({
  args: {
    signingToken: v.string(),
    fieldId: v.id("signature_fields"),
    value: v.optional(v.string()),
    signatureImageUrl: v.optional(v.string()),
    signatureMethod: v.optional(signatureMethodTuple), // SEA-108: draw, type, or upload
    ipAddress: v.string(),
    userAgent: v.string(),
  },
  handler: async (ctx, args) => {
    const signatureContext = await prepareTokenSignatureSave(
      ctx,
      args.signingToken,
      args
    );
    const payload = await computeSignaturePayload(
      signatureContext.recipient._id,
      {
        fieldId: args.fieldId,
        value: args.value,
        signatureImageUrl: args.signatureImageUrl,
        signatureMethod: args.signatureMethod,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
      signatureContext.document.documentHash || ""
    );

    const result = await upsertSignatureRecord(
      ctx,
      signatureContext,
      {
        fieldId: args.fieldId,
        value: args.value,
        signatureImageUrl: args.signatureImageUrl,
        signatureMethod: args.signatureMethod,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
      payload
    );

    await autoSubmitMainSignature(
      ctx,
      signatureContext.recipient,
      signatureContext.document,
      signatureContext.field,
      args.signatureImageUrl,
      args.ipAddress
    );

    return result;
  },
});

/**
 * Save or update a field value for authenticated users who are recipients
 * Used for in-app signing when the user is both authenticated and a recipient
 *
 * SEA-108: Includes cryptographic signature hash for verification
 */
export const saveFieldValueAuthenticated = authMutation({
  args: {
    documentId: v.id("documents"),
    fieldId: v.id("signature_fields"),
    value: v.optional(v.string()),
    signatureImageUrl: v.optional(v.string()),
    signatureMethod: v.optional(signatureMethodTuple),
    ipAddress: v.optional(v.string()),
    userAgent: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const signatureContext = await prepareAuthenticatedSignatureSave(
      ctx,
      userId,
      args.documentId,
      args
    );
    if (
      signatureContext.recipient.status === "signed" ||
      signatureContext.recipient.status === "declined"
    ) {
      throw new Error("You have already completed your signing action");
    }

    const ipAddress = args.ipAddress ?? "web-authenticated";
    const payload = await computeSignaturePayload(
      signatureContext.recipient._id,
      {
        fieldId: args.fieldId,
        value: args.value,
        signatureImageUrl: args.signatureImageUrl,
        signatureMethod: args.signatureMethod,
        ipAddress,
        userAgent: args.userAgent,
      },
      signatureContext.document.documentHash || ""
    );

    const result = await upsertSignatureRecord(
      ctx,
      signatureContext,
      {
        fieldId: args.fieldId,
        value: args.value,
        signatureImageUrl: args.signatureImageUrl,
        signatureMethod: args.signatureMethod,
        ipAddress,
        userAgent: args.userAgent,
      },
      payload
    );

    // Note: For authenticated users, we do NOT auto-sign on main signature field.
    // The user must explicitly click "Sign Document" to submit, which ensures
    // all required fields are filled before marking the document as signed.
    // This is different from token-based signing where main signature auto-submits.

    return result;
  },
});
