/**
 * Document sending action - sends emails to recipients
 * Actions can call external services like Resend
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalMutation } from "../_generated/server";
import { sendDocumentInvitation } from "./email";

async function authorizeDocumentOwner(
  ctx: ActionCtx,
  documentId: Id<"documents">,
): Promise<{ document: Doc<"documents">; userId: Id<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId,
  });

  if (!document) {
    throw new ConvexError("Document not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId: document.organizationId,
    },
  );

  if (!membership) {
    throw new ConvexError("You don't have access to this document");
  }

  if (document.ownerId !== user._id) {
    throw new ConvexError("Only the document owner can perform this action");
  }

  return { document, userId: user._id };
}

/**
 * Internal mutation to update document status to sent
 * SEA-119: Also saves optional deadline
 * Also shares document with recipients who have existing user accounts
 */
export const markDocumentAsSent = internalMutation({
  args: {
    documentId: v.id("documents"),
    deadline: v.optional(v.number()), // SEA-119: Signing deadline
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // Get all recipients for this document
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Share document with recipients who have existing accounts
    let sharedWithAnyUser = false;
    for (const recipient of recipients) {
      // Look up user by email
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", recipient.email))
        .first();

      if (existingUser) {
        // Check if user is a member of the document's organization
        const orgMember = await ctx.db
          .query("organization_members")
          .withIndex("by_user_organization", (q) =>
            q.eq("userId", existingUser._id).eq("organizationId", document.organizationId),
          )
          .first();

        if (orgMember && orgMember.status === "active") {
          // Check if access already exists
          const existingAccess = await ctx.db
            .query("document_access")
            .withIndex("by_document_user", (q) =>
              q.eq("documentId", args.documentId).eq("userId", existingUser._id),
            )
            .first();

          // Only create access if it doesn't exist or was revoked
          if (!existingAccess || existingAccess.revokedAt !== undefined) {
            if (existingAccess) {
              // Reactivate revoked access
              await ctx.db.patch(existingAccess._id, {
                permissionLevel: "view",
                grantedBy: document.ownerId,
                grantedAt: Date.now(),
                revokedAt: undefined,
              });
            } else {
              // Create new access record
              await ctx.db.insert("document_access", {
                documentId: args.documentId,
                userId: existingUser._id,
                permissionLevel: "view",
                grantedBy: document.ownerId,
                grantedAt: Date.now(),
              });
            }
            sharedWithAnyUser = true;
          }
        }

        // Link the userId to the recipient record for easier tracking
        if (!recipient.userId) {
          await ctx.db.patch(recipient._id, {
            userId: existingUser._id,
            updatedAt: Date.now(),
          });
        }
      }
    }

    // If we shared with any user, update the sharing mode to "specific"
    // so the document_access records are respected by queries
    if (sharedWithAnyUser && document.sharingMode === "private") {
      await ctx.db.patch(args.documentId, {
        sharingMode: "specific",
      });
    }

    // Update document status to active and workflow status to sent
    await ctx.db.patch(args.documentId, {
      status: "active",
      workflowStatus: "sent",
      sentAt: Date.now(),
      updatedAt: Date.now(),
      ...(args.deadline && { deadline: args.deadline }), // SEA-119: Save deadline if provided
    });

    return { success: true };
  },
});

/**
 * Send document to all recipients via email
 * This is an action (not mutation) because it calls external email service
 * SEA-119: Supports per-recipient custom messages and document deadline
 */
export const sendDocumentEmails = action({
  args: {
    documentId: v.id("documents"),
    customMessage: v.optional(v.string()), // Default message for all recipients
    stripeInvoiceId: v.optional(v.string()),
    recipientMessages: v.optional(
      v.array(
        v.object({
          recipientId: v.id("document_recipients"),
          message: v.string(),
        }),
      ),
    ), // SEA-119: Per-recipient custom messages
    deadline: v.optional(v.number()), // SEA-119: Signing deadline timestamp
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    totalRecipients: number;
    emailsSent: number;
    emailsFailed: number;
    failures: Array<{
      recipientId: Id<"document_recipients">;
      success: boolean;
      error?: string;
    }>;
  }> => {
    // 1. Authenticate and authorize
    const { document, userId } = await authorizeDocumentOwner(ctx, args.documentId);

    // 2. Get all recipients
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      {
        documentId: args.documentId,
      },
    );

    if (recipients.length === 0) {
      throw new ConvexError("No recipients found");
    }

    // 3. Validate document has at least one signature field
    const signatureFields = await ctx.runQuery(
      internal.signature_fields.queries.getFieldsByDocumentInternal,
      {
        documentId: args.documentId,
      },
    );

    const signatureFieldCount = signatureFields.filter(
      (field) => field.fieldType === "signature",
    ).length;

    if (signatureFieldCount === 0) {
      throw new ConvexError(
        "Cannot send document without signature fields. Please add at least one signature field before sending.",
      );
    }

    // 3b. Validate payment fields have configs
    const paymentFields = signatureFields.filter((f) => f.fieldType === "payment");
    if (paymentFields.length > 0) {
      const paymentConfigs = await ctx.runQuery(
        internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
        { documentId: args.documentId },
      );
      const configuredFieldIds = new Set(paymentConfigs.map((c) => c.fieldId.toString()));
      const unconfigured = paymentFields.filter((f) => !configuredFieldIds.has(f._id.toString()));
      if (unconfigured.length > 0) {
        throw new ConvexError(
          "All payment fields must be configured before sending. Please configure payment details for each payment field.",
        );
      }
    }

    // 4. Optional Stripe invoice finalize (if requested — legacy invoice system)
    // Draft invoices have no hosted link; finalize before emailing recipients.
    let invoicePayload:
      | {
          hostedInvoiceUrl?: string;
          amountDue?: number;
          currency?: string;
          customerEmail?: string;
        }
      | undefined;

    if (args.stripeInvoiceId) {
      const invoiceResult = await ctx.runAction(
        internal.stripe.invoice_actions.finalizeInvoiceForDocumentInternal,
        {
          documentId: args.documentId,
          stripeInvoiceId: args.stripeInvoiceId,
        },
      );

      invoicePayload = {
        hostedInvoiceUrl: invoiceResult.hostedInvoiceUrl ?? undefined,
        amountDue: invoiceResult.amountDue ?? undefined,
        currency: invoiceResult.currency ?? undefined,
        customerEmail: invoiceResult.customerEmail ?? undefined,
      };
    }

    // 4b. Create Stripe invoices for payment field configs
    let paymentInvoiceLinks: Array<{
      recipientEmail: string;
      hostedInvoiceUrl: string | null;
      stripeInvoiceId: string;
      totalAmountCents: number;
      currency: string;
    }> = [];

    if (paymentFields.length > 0) {
      const paymentResult = await ctx.runAction(
        internal.stripe.payment_field_actions.createStripeObjectsForPaymentFields,
        {
          documentId: args.documentId,
          organizationId: document.organizationId,
          userId,
        },
      );
      paymentInvoiceLinks = paymentResult.invoiceLinks;
    }

    // 5. Get sender information from document owner
    // For now, we'll get it from the document query
    // TODO: Add user query or get from context
    const senderName = "Seal User";

    // 6. Build a map of per-recipient messages (SEA-119)
    const recipientMessageMap = new Map<Id<"document_recipients">, string>();
    if (args.recipientMessages) {
      for (const rm of args.recipientMessages) {
        recipientMessageMap.set(rm.recipientId, rm.message);
      }
    }

    // 7. Send emails to all recipients
    // Invoice link is only sent to the recipient matching the invoice customer email.
    const emailResults: Array<{
      recipientId: Id<"document_recipients">;
      success: boolean;
      error?: string;
    }> = [];

    for (const recipient of recipients) {
      // Only send to recipients who haven't completed their action
      if (
        recipient.status === "signed" ||
        recipient.status === "approved" ||
        recipient.status === "declined"
      ) {
        continue;
      }

      // Generate signing URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
      const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;

      // SEA-119: Use per-recipient message if available, otherwise fallback to default
      const messageForRecipient = recipientMessageMap.get(recipient._id) || args.customMessage;

      // SEA-119: Use deadline if provided, otherwise use token expiration
      const expiresAt = args.deadline || recipient.tokenExpiresAt;

      // Resolve invoice link: prefer payment field invoice, fallback to legacy invoice
      const paymentLink = paymentInvoiceLinks.find(
        (link) => link.recipientEmail === recipient.email,
      );
      const resolvedInvoiceUrl =
        paymentLink?.hostedInvoiceUrl ??
        (invoicePayload?.hostedInvoiceUrl &&
        invoicePayload?.customerEmail &&
        invoicePayload.customerEmail === recipient.email
          ? invoicePayload.hostedInvoiceUrl
          : undefined);
      const resolvedInvoiceAmount = paymentLink
        ? paymentLink.totalAmountCents
        : invoicePayload?.customerEmail && invoicePayload.customerEmail === recipient.email
          ? invoicePayload.amountDue
          : undefined;
      const resolvedInvoiceCurrency = paymentLink
        ? paymentLink.currency
        : invoicePayload?.customerEmail && invoicePayload.customerEmail === recipient.email
          ? invoicePayload.currency
          : undefined;

      // Send email
      const emailResult = await sendDocumentInvitation({
        to: recipient.email,
        recipientName: recipient.name || recipient.email,
        documentName: document.name,
        senderName,
        signingUrl,
        customMessage: messageForRecipient,
        expiresAt,
        invoiceUrl: resolvedInvoiceUrl ?? undefined,
        invoiceAmount: resolvedInvoiceAmount,
        invoiceCurrency: resolvedInvoiceCurrency,
      });

      emailResults.push({
        recipientId: recipient._id,
        success: emailResult.success,
        error: emailResult.error,
      });
    }

    // 7. Check if any emails failed
    const failedEmails = emailResults.filter((r) => !r.success);
    const allEmailsSucceeded = failedEmails.length === 0;

    // 8. Mark document as sent only when all emails succeed so edits remain possible on failures
    if (allEmailsSucceeded) {
      await ctx.runMutation(internal.documents.send_document_action.markDocumentAsSent, {
        documentId: args.documentId,
        deadline: args.deadline, // SEA-119: Pass deadline to be saved
      });
    }

    return {
      success: allEmailsSucceeded,
      totalRecipients: recipients.length,
      emailsSent: emailResults.filter((r) => r.success).length,
      emailsFailed: failedEmails.length,
      failures: failedEmails,
    };
  },
});

/**
 * Resend email to a specific recipient
 * This allows resending to recipients who haven't completed their action
 */
export const resendRecipientEmail = action({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
    customMessage: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    // 1. Authenticate and authorize
    const { document } = await authorizeDocumentOwner(ctx, args.documentId);

    // 2. Verify document has been sent (not in draft)
    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus === "draft") {
      return {
        success: false,
        error: "Cannot resend email - document has not been sent yet",
      };
    }

    // 3. Get specific recipient
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      {
        documentId: args.documentId,
      },
    );

    const recipient = recipients.find((r) => r._id === args.recipientId);
    if (!recipient) {
      return { success: false, error: "Recipient not found" };
    }

    // 4. Verify recipient hasn't completed their action
    if (
      recipient.status === "signed" ||
      recipient.status === "approved" ||
      recipient.status === "declined"
    ) {
      return {
        success: false,
        error: `Cannot resend - recipient has already ${recipient.status}`,
      };
    }

    // 5. Generate signing URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
    const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;

    // 6. Get sender information
    // TODO: Get actual sender name from user
    const senderName = "Seal User";

    // 7. Send email
    const emailResult = await sendDocumentInvitation({
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: document.name,
      senderName,
      signingUrl,
      customMessage: args.customMessage,
      expiresAt: recipient.tokenExpiresAt,
    });

    return {
      success: emailResult.success,
      error: emailResult.error,
    };
  },
});
