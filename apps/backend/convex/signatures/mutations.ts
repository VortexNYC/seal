import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { logSignatureAction } from "../audit_logs/helpers";
import { authMutation } from "../auth";
import { encryptSignatureData } from "../crypto/encryption";
import { generateSignatureHash, generateSignatureImageHash } from "../crypto/helpers";

/** Get the signature encryption key from environment (undefined in dev = no encryption). */
function getEncryptionKey(): string | undefined {
  return process.env.SIGNATURE_ENCRYPTION_KEY;
}
import { findRecipientByToken } from "../documents/recipient_helpers";
import { authenticationMethodTuple } from "../schemas/recipients";
import { publishWebhookEvent } from "../webhooks/publish";
import {
  validateAgainstRules,
  validateSignature,
  verifyDocumentIntegrityForSigning,
} from "./helpers";

// Signature method type
const signatureMethodTuple = v.union(v.literal("draw"), v.literal("type"), v.literal("upload"));

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
      }),
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
      args.signatureImageUrl,
    );
    if (!signatureValidation.valid) {
      throw new Error(signatureValidation.error);
    }

    // Validate against field validation rules
    if (args.value) {
      const rulesValidation = validateAgainstRules(args.value, field.validationRules);
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
    const signatureImageHash = await generateSignatureImageHash(args.signatureImageUrl);

    // Encrypt signature image data before storage
    const encKey = getEncryptionKey();
    const encryptedImageUrl = await encryptSignatureData(args.signatureImageUrl, encKey);

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

    const signatureValidation = validateSignature(field.fieldType, newValue, newImageUrl);
    if (!signatureValidation.valid) {
      throw new Error(signatureValidation.error);
    }

    // Validate against field validation rules
    if (newValue) {
      const rulesValidation = validateAgainstRules(newValue, field.validationRules);
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
      args.signatureImageUrl ?? signature.signatureImageUrl,
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
    // 1. Validate signing token and get recipient (hash-based lookup with plaintext fallback)
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new Error("Invalid signing token");
    }

    // 2. Check token expiration
    if (recipient.tokenExpiresAt < Date.now()) {
      throw new Error("Signing token has expired");
    }

    // 3. Get the field
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // 4. Verify field is assigned to this recipient
    if (field.recipientId !== recipient._id) {
      throw new Error("This field is not assigned to you");
    }

    // 5. Verify field belongs to the same document
    if (field.documentId !== recipient.documentId) {
      throw new Error("Field does not belong to this document");
    }

    // 6. Get document and verify it's not completed
    const document = await ctx.db.get(field.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    if (document.workflowStatus === "completed") {
      throw new Error("Cannot modify fields on completed document");
    }

    // 6b. Verify document integrity — block if document was modified after prior signatures
    await verifyDocumentIntegrityForSigning(ctx, document);

    // 7. Validate signature data based on field type
    const signatureValidation = validateSignature(
      field.fieldType,
      args.value,
      args.signatureImageUrl,
    );
    if (!signatureValidation.valid) {
      throw new Error(signatureValidation.error || "Invalid field value");
    }

    // 8. Validate against field validation rules
    if (args.value && field.validationRules) {
      const rulesValidation = validateAgainstRules(args.value, field.validationRules);
      if (!rulesValidation.valid) {
        throw new Error(rulesValidation.error || "Value does not meet validation requirements");
      }
    }

    // 9. Check if signature already exists
    const existingSignature = await ctx.db
      .query("signatures")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .first();

    let signatureId: import("../_generated/dataModel").Id<"signatures">;

    // SEA-108: Compute signature hash for cryptographic verification
    const signedAt = Date.now();
    const signatureData = args.value || args.signatureImageUrl || "";
    const documentHash = document.documentHash || "";
    const signatureHash = await generateSignatureHash(
      signatureData,
      recipient._id,
      args.fieldId,
      documentHash,
      signedAt,
    );

    // Compute signature image hash for reuse detection (hash raw data before encryption)
    const signatureImageHash = await generateSignatureImageHash(args.signatureImageUrl);

    // Encrypt signature image data before storage
    const encKey = getEncryptionKey();
    const encryptedImageUrl = await encryptSignatureData(args.signatureImageUrl, encKey);

    if (existingSignature) {
      // Update existing signature
      await ctx.db.patch(existingSignature._id, {
        ...(args.value !== undefined && { value: args.value }),
        ...(args.signatureImageUrl !== undefined && {
          signatureImageUrl: encryptedImageUrl,
        }),
        signedAt,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        // SEA-108: Update cryptographic fields
        signatureHash,
        signatureImageHash,
        documentHashAtSigning: documentHash,
        signatureMethod: args.signatureMethod,
        updatedAt: Date.now(),
      });
      signatureId = existingSignature._id;

      // Log update to audit trail
      await logSignatureAction(ctx, {
        organizationId: document.organizationId,
        recipientId: recipient._id,
        action: "signature.updated",
        signatureId: existingSignature._id,
        fieldId: args.fieldId,
        documentId: field.documentId,
        oldValues: {
          value: existingSignature.value,
        },
        newValues: {
          value: args.value,
          signatureHash,
        },
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      });
    } else {
      // Create new signature with cryptographic hash
      signatureId = await ctx.db.insert("signatures", {
        fieldId: args.fieldId,
        recipientId: recipient._id,
        documentId: field.documentId,
        value: args.value,
        signatureImageUrl: encryptedImageUrl,
        // SEA-108: Cryptographic signature data
        signatureHash,
        signatureImageHash,
        documentHashAtSigning: documentHash,
        signatureMethod: args.signatureMethod,
        signedAt,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Log creation to audit trail
      await logSignatureAction(ctx, {
        organizationId: document.organizationId,
        recipientId: recipient._id,
        action: "signature.created",
        signatureId,
        fieldId: args.fieldId,
        documentId: field.documentId,
        newValues: {
          value: args.value,
          signatureHash,
        },
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      });
    }

    // If this is the main signature field, auto-sign the document
    if (field.isMainSignature === true && field.fieldType === "signature") {
      // Determine status based on recipient role
      const status =
        recipient.role === "signer"
          ? "signed"
          : recipient.role === "approver"
            ? "approved"
            : "viewed";

      // Update recipient status and signature data
      await ctx.db.patch(recipient._id, {
        status,
        signatureData: args.signatureImageUrl,
        signatureType: "drawn", // Assuming drawn for now, could be enhanced
        signedAt: status === "signed" ? Date.now() : undefined,
        approvedAt: status === "approved" ? Date.now() : undefined,
      });

      // Publish webhook event for recipient signing
      if (status === "signed" || status === "approved") {
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
    }

    return { signatureId, isUpdate: !!existingSignature };
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

    // 1. Get user email for recipient matching
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      throw new Error("User not found or has no email");
    }

    const userEmail = user.email.toLowerCase();

    // 2. Get the document and verify it's in a signable state
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    if (document.status === "deleted") {
      throw new Error("Document has been deleted");
    }

    // Only allow signing when document is sent or in_progress (not draft or completed)
    if (document.workflowStatus === "draft" || !document.workflowStatus) {
      throw new Error("Document must be sent before signing");
    }

    if (document.workflowStatus === "completed") {
      throw new Error("Cannot modify fields on completed document");
    }

    // 2b. Verify document integrity — block if document was modified after prior signatures
    await verifyDocumentIntegrityForSigning(ctx, document);

    // 3. Find recipient by document + email match
    const recipient = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first();

    if (!recipient) {
      throw new Error("You are not a recipient on this document");
    }

    // 4. Check if recipient has already completed signing
    if (recipient.status === "signed" || recipient.status === "declined") {
      throw new Error("You have already completed your signing action");
    }

    // 5. Get the field
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new Error("Field not found");
    }

    // 6. Verify field is assigned to this recipient
    if (field.recipientId !== recipient._id) {
      throw new Error("This field is not assigned to you");
    }

    // 7. Verify field belongs to the same document
    if (field.documentId !== args.documentId) {
      throw new Error("Field does not belong to this document");
    }

    // 8. Validate signature data based on field type
    const signatureValidation = validateSignature(
      field.fieldType,
      args.value,
      args.signatureImageUrl,
    );
    if (!signatureValidation.valid) {
      throw new Error(signatureValidation.error || "Invalid field value");
    }

    // 9. Validate against field validation rules
    if (args.value && field.validationRules) {
      const rulesValidation = validateAgainstRules(args.value, field.validationRules);
      if (!rulesValidation.valid) {
        throw new Error(rulesValidation.error || "Value does not meet validation requirements");
      }
    }

    // 10. Check if signature already exists
    const existingSignature = await ctx.db
      .query("signatures")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .first();

    let signatureId: import("../_generated/dataModel").Id<"signatures">;

    // SEA-108: Compute signature hash for cryptographic verification
    const signedAt = Date.now();
    const signatureData = args.value || args.signatureImageUrl || "";
    const documentHash = document.documentHash || "";
    const signatureHash = await generateSignatureHash(
      signatureData,
      recipient._id,
      args.fieldId,
      documentHash,
      signedAt,
    );

    // Get IP address from args or use default for authenticated flow
    const ipAddress = args.ipAddress ?? "web-authenticated";

    // Compute signature image hash for reuse detection (hash raw data before encryption)
    const signatureImageHash = await generateSignatureImageHash(args.signatureImageUrl);

    // Encrypt signature image data before storage
    const encKey = getEncryptionKey();
    const encryptedImageUrl = await encryptSignatureData(args.signatureImageUrl, encKey);

    if (existingSignature) {
      // Update existing signature
      await ctx.db.patch(existingSignature._id, {
        ...(args.value !== undefined && { value: args.value }),
        ...(args.signatureImageUrl !== undefined && {
          signatureImageUrl: encryptedImageUrl,
        }),
        signedAt,
        ipAddress,
        userAgent: args.userAgent,
        signatureHash,
        signatureImageHash,
        documentHashAtSigning: documentHash,
        signatureMethod: args.signatureMethod,
        updatedAt: Date.now(),
      });
      signatureId = existingSignature._id;

      // Log update to audit trail
      // Cast ctx to MutationCtx since authMutation replaces auth type but db is still compatible
      await logSignatureAction(ctx as unknown as MutationCtx, {
        organizationId: document.organizationId,
        recipientId: recipient._id,
        action: "signature.updated",
        signatureId: existingSignature._id,
        fieldId: args.fieldId,
        documentId: args.documentId,
        oldValues: {
          value: existingSignature.value,
        },
        newValues: {
          value: args.value,
          signatureHash,
        },
        ipAddress,
        userAgent: args.userAgent,
      });
    } else {
      // Create new signature with cryptographic hash
      signatureId = await ctx.db.insert("signatures", {
        fieldId: args.fieldId,
        recipientId: recipient._id,
        documentId: args.documentId,
        value: args.value,
        signatureImageUrl: encryptedImageUrl,
        signatureHash,
        signatureImageHash,
        documentHashAtSigning: documentHash,
        signatureMethod: args.signatureMethod,
        signedAt,
        ipAddress,
        userAgent: args.userAgent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Log creation to audit trail
      // Cast ctx to MutationCtx since authMutation replaces auth type but db is still compatible
      await logSignatureAction(ctx as unknown as MutationCtx, {
        organizationId: document.organizationId,
        recipientId: recipient._id,
        action: "signature.created",
        signatureId,
        fieldId: args.fieldId,
        documentId: args.documentId,
        newValues: {
          value: args.value,
          signatureHash,
        },
        ipAddress,
        userAgent: args.userAgent,
      });
    }

    // Note: For authenticated users, we do NOT auto-sign on main signature field.
    // The user must explicitly click "Sign Document" to submit, which ensures
    // all required fields are filled before marking the document as signed.
    // This is different from token-based signing where main signature auto-submits.

    return { signatureId, isUpdate: !!existingSignature };
  },
});
