/**
 * Document sending action - sends emails to recipients
 * Actions can call external services like Resend
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import { logDocumentAction } from "../audit_logs/helpers";
import { publishWebhookEvent } from "../webhooks/publish";
import { sendDocumentInvitation } from "./email";
import { findFirstIncompleteGroup } from "./recipient_helpers";

type PaymentInvoiceLink = {
  recipientEmail: string;
  hostedInvoiceUrl: string | null;
  stripeInvoiceId?: string;
  paymentObjectId?: string;
  totalAmountCents: number;
  currency: string;
};

type InvitationEmailResult = {
  recipientId: Id<"document_recipients">;
  success: boolean;
  error?: string;
};

type SendDocumentEmailsResult = {
  success: boolean;
  totalRecipients: number;
  emailsSent: number;
  emailsFailed: number;
  failures: InvitationEmailResult[];
};

type ExpirationPeriod = {
  amount: number;
  unit: "day" | "week" | "month";
};

type DocumentMutationCtx = Pick<MutationCtx, "db">;

type MarkDocumentAsSentArgs = {
  documentId: Id<"documents">;
  deadline?: number;
  userId?: string;
  signingMode?: "parallel" | "sequential";
  allowDictateNextSigner?: boolean;
  expirationPeriod?: ExpirationPeriod;
};

/** Convert expiration period to milliseconds */
export function expirationPeriodToMs(amount: number, unit: "day" | "week" | "month"): number {
  const MS_PER_DAY = 86_400_000;
  switch (unit) {
    case "day":
      return amount * MS_PER_DAY;
    case "week":
      return amount * 7 * MS_PER_DAY;
    case "month":
      return amount * 30 * MS_PER_DAY;
  }
}

function isRecipientDone(status: Doc<"document_recipients">["status"]): boolean {
  return status === "signed" || status === "approved" || status === "declined";
}

function getRecipientsToEmail(
  document: Doc<"documents">,
  recipients: Doc<"document_recipients">[],
): Doc<"document_recipients">[] {
  if (document.signingMode === "sequential") {
    return findFirstIncompleteGroup(recipients);
  }

  return recipients.filter((recipient) => !isRecipientDone(recipient.status));
}

function buildRecipientMessageMap(
  recipientMessages: Array<{ recipientId: Id<"document_recipients">; message: string }> | undefined,
): Map<Id<"document_recipients">, string> {
  const recipientMessageMap = new Map<Id<"document_recipients">, string>();

  for (const recipientMessage of recipientMessages ?? []) {
    recipientMessageMap.set(recipientMessage.recipientId, recipientMessage.message);
  }

  return recipientMessageMap;
}

async function getSenderEmailContext(
  ctx: ActionCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
) {
  const senderUser = await ctx.runQuery(internal.organizations.helpers.getUserById, {
    userId,
  });
  const brandingSettings = await ctx.runQuery(
    internal.organizations.queries.getBrandingSettingsInternal,
    { organizationId },
  );

  return {
    senderUser,
    senderName: senderUser?.name ?? senderUser?.email ?? "Seal User",
    emailBranding: brandingSettings.enabled
      ? {
          emailFromName: brandingSettings.emailFromName,
          emailReplyTo: brandingSettings.emailReplyTo,
        }
      : undefined,
  };
}

function getEmailDeadline(
  deadline: number | undefined,
  expirationPeriod: ExpirationPeriod | undefined,
): number | undefined {
  if (deadline) {
    return deadline;
  }

  if (!expirationPeriod) {
    return undefined;
  }

  return Date.now() + expirationPeriodToMs(expirationPeriod.amount, expirationPeriod.unit);
}

function resolveInvoiceDetails(paymentInvoiceLinks: PaymentInvoiceLink[], recipientEmail: string) {
  const paymentLink = paymentInvoiceLinks.find((link) => link.recipientEmail === recipientEmail);
  return {
    invoiceUrl: paymentLink?.hostedInvoiceUrl ?? undefined,
    invoiceAmount: paymentLink?.totalAmountCents,
    invoiceCurrency: paymentLink?.currency,
  };
}

export function parseVortexBillingPayableOrganizationIds(
  raw: string | undefined,
): ReadonlySet<string> {
  if (raw === undefined || raw.trim().length === 0) {
    return new Set();
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      throw new ConvexError("VORTEX_BILLING_PAYABLE_ORGANIZATION_IDS must be valid JSON");
    }
    if (!Array.isArray(parsed)) {
      throw new ConvexError("VORTEX_BILLING_PAYABLE_ORGANIZATION_IDS must be a JSON array");
    }
    return new Set(
      parsed.map((entry) => {
        if (typeof entry !== "string" || entry.trim().length === 0) {
          throw new ConvexError(
            "VORTEX_BILLING_PAYABLE_ORGANIZATION_IDS entries must be non-empty strings",
          );
        }
        return entry.trim();
      }),
    );
  }

  return new Set(
    trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

export function isVortexBillingPayableEnabledForOrganizationId(
  organizationId: string,
  rawEnabledOrganizationIds: string | undefined,
): boolean {
  const enabledOrganizationIds =
    parseVortexBillingPayableOrganizationIds(rawEnabledOrganizationIds);
  return enabledOrganizationIds.has("*") || enabledOrganizationIds.has(organizationId);
}

function isVortexBillingPayableEnabledForOrganization(
  organizationId: Id<"organizations">,
): boolean {
  return isVortexBillingPayableEnabledForOrganizationId(
    organizationId.toString(),
    process.env.VORTEX_BILLING_PAYABLE_ORGANIZATION_IDS,
  );
}

async function sendInvitationBatch(
  ctx: ActionCtx,
  params: {
    recipients: Doc<"document_recipients">[];
    documentName: string;
    documentId: Id<"documents">;
    organizationId: Id<"organizations">;
    senderName: string;
    customMessage: string | undefined;
    recipientMessageMap: Map<Id<"document_recipients">, string>;
    emailBranding:
      | {
          emailFromName?: string;
          emailReplyTo?: string;
        }
      | undefined;
    paymentInvoiceLinks: PaymentInvoiceLink[];
    deadline: number | undefined;
  },
): Promise<InvitationEmailResult[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
  const results: InvitationEmailResult[] = [];

  for (const recipient of params.recipients) {
    if (isRecipientDone(recipient.status)) {
      continue;
    }

    const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;
    const invoiceDetails = resolveInvoiceDetails(params.paymentInvoiceLinks, recipient.email);
    const emailResult = await sendDocumentInvitation(ctx, {
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: params.documentName,
      senderName: params.senderName,
      signingUrl,
      customMessage: params.recipientMessageMap.get(recipient._id) || params.customMessage,
      expiresAt: params.deadline || recipient.expiresAt || recipient.tokenExpiresAt,
      invoiceUrl: invoiceDetails.invoiceUrl,
      invoiceAmount: invoiceDetails.invoiceAmount,
      invoiceCurrency: invoiceDetails.invoiceCurrency,
      branding: params.emailBranding,
      organizationId: params.organizationId,
      documentId: params.documentId,
      recipientId: recipient._id,
    });

    results.push({
      recipientId: recipient._id,
      success: emailResult.success,
      error: emailResult.error,
    });
  }

  return results;
}

async function getRecipientsOrThrow(
  ctx: ActionCtx,
  documentId: Id<"documents">,
): Promise<Doc<"document_recipients">[]> {
  const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
    internal.documents.recipients_queries.getDocumentRecipientsInternal,
    { documentId },
  );

  if (recipients.length === 0) {
    throw new ConvexError("No recipients found");
  }

  return recipients;
}

async function getPaymentInvoiceLinksForDocument(
  ctx: ActionCtx,
  params: {
    documentId: Id<"documents">;
    organizationId: Id<"organizations">;
    userId: Id<"users">;
  },
): Promise<PaymentInvoiceLink[]> {
  const signatureFields = await ctx.runQuery(
    internal.signature_fields.queries.getFieldsByDocumentInternal,
    {
      documentId: params.documentId,
    },
  );

  if (
    !signatureFields.some(
      (field: (typeof signatureFields)[number]) => field.fieldType === "signature",
    )
  ) {
    throw new ConvexError(
      "Cannot send document without signature fields. Please add at least one signature field before sending.",
    );
  }

  const paymentFields = signatureFields.filter(
    (field: (typeof signatureFields)[number]) => field.fieldType === "payment",
  );
  if (paymentFields.length === 0) {
    return [];
  }

  const paymentConfigs = await ctx.runQuery(
    internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
    { documentId: params.documentId },
  );
  const configuredFieldIds = new Set(
    paymentConfigs.map((config: (typeof paymentConfigs)[number]) => config.fieldId.toString()),
  );

  if (
    paymentFields.some(
      (field: (typeof paymentFields)[number]) => !configuredFieldIds.has(field._id.toString()),
    )
  ) {
    throw new ConvexError(
      "All payment fields must be configured before sending. Please configure payment details for each payment field.",
    );
  }

  const paymentResult = isVortexBillingPayableEnabledForOrganization(params.organizationId)
    ? await ctx.runAction(
        internal.vortex_billing.payable_actions.createVortexPayablesForPaymentFields,
        {
          documentId: params.documentId,
          organizationId: params.organizationId,
          userId: params.userId,
        },
      )
    : await ctx.runAction(
        internal.stripe.payment_field_actions.createStripeObjectsForPaymentFields,
        {
          documentId: params.documentId,
          organizationId: params.organizationId,
          userId: params.userId,
        },
      );

  return paymentResult.invoiceLinks;
}

type ProvePaymentInvoiceLinksResult = {
  readonly invoiceLinks: PaymentInvoiceLink[];
  readonly configs: readonly {
    readonly configId: Id<"payment_field_configs">;
    readonly paymentStatus:
      | "pending"
      | "created"
      | "awaiting"
      | "paid"
      | "failed"
      | "cancelled"
      | undefined;
    readonly vortexPayableId: string | undefined;
    readonly vortexPaymentRequestId: string | undefined;
    readonly hostedInvoiceUrl: string | undefined;
    readonly stripeInvoiceId: string | undefined;
    readonly stripePaymentIntentId: string | undefined;
    readonly stripeSubscriptionId: string | undefined;
  }[];
};

export const provePaymentInvoiceLinksForDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<ProvePaymentInvoiceLinksResult> => {
    const invoiceLinks = await getPaymentInvoiceLinksForDocument(ctx, args);
    const paymentConfigs = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId },
    );

    return {
      invoiceLinks,
      configs: paymentConfigs.map((config) => ({
        configId: config._id,
        paymentStatus: config.paymentStatus,
        vortexPayableId: config.vortexPayableId,
        vortexPaymentRequestId: config.vortexPaymentRequestId,
        hostedInvoiceUrl: config.hostedInvoiceUrl,
        stripeInvoiceId: config.stripeInvoiceId,
        stripePaymentIntentId: config.stripePaymentIntentId,
        stripeSubscriptionId: config.stripeSubscriptionId,
      })),
    };
  },
});

function buildSendDocumentEmailsResult(
  recipients: Doc<"document_recipients">[],
  emailResults: InvitationEmailResult[],
): SendDocumentEmailsResult {
  const failures = emailResults.filter((result) => !result.success);

  return {
    success: failures.length === 0,
    totalRecipients: recipients.length,
    emailsSent: emailResults.filter((result) => result.success).length,
    emailsFailed: failures.length,
    failures,
  };
}

async function syncRecipientAccess(
  ctx: DocumentMutationCtx,
  document: Doc<"documents">,
  recipient: Doc<"document_recipients">,
  documentId: Id<"documents">,
): Promise<boolean> {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", recipient.email))
    .first();

  if (!existingUser) {
    return false;
  }

  const orgMember = await ctx.db
    .query("organization_members")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", existingUser._id).eq("organizationId", document.organizationId),
    )
    .first();

  let grantedAccess = false;
  if (orgMember?.status === "active") {
    const existingAccess = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", documentId).eq("userId", existingUser._id),
      )
      .first();

    if (!existingAccess || existingAccess.revokedAt !== undefined) {
      if (existingAccess) {
        await ctx.db.patch(existingAccess._id, {
          permissionLevel: "view",
          grantedBy: document.ownerId,
          grantedAt: Date.now(),
          revokedAt: undefined,
        });
      } else {
        await ctx.db.insert("document_access", {
          documentId,
          userId: existingUser._id,
          permissionLevel: "view",
          grantedBy: document.ownerId,
          grantedAt: Date.now(),
        });
      }
      grantedAccess = true;
    }
  }

  if (!recipient.userId) {
    await ctx.db.patch(recipient._id, {
      userId: existingUser._id,
      updatedAt: Date.now(),
    });
  }

  return grantedAccess;
}

async function shareDocumentWithRecipients(
  ctx: DocumentMutationCtx,
  document: Doc<"documents">,
  recipients: Doc<"document_recipients">[],
  documentId: Id<"documents">,
) {
  let sharedWithAnyUser = false;

  for (const recipient of recipients) {
    if (await syncRecipientAccess(ctx, document, recipient, documentId)) {
      sharedWithAnyUser = true;
    }
  }

  if (sharedWithAnyUser && document.sharingMode === "private") {
    await ctx.db.patch(documentId, {
      sharingMode: "specific",
    });
  }
}

async function applyRecipientExpirationPeriod(
  ctx: DocumentMutationCtx,
  recipients: Doc<"document_recipients">[],
  expirationPeriod: ExpirationPeriod | undefined,
) {
  if (!expirationPeriod) {
    return;
  }

  const now = Date.now();
  const expiresAt = now + expirationPeriodToMs(expirationPeriod.amount, expirationPeriod.unit);

  for (const recipient of recipients) {
    await ctx.db.patch(recipient._id, {
      expiresAt,
      updatedAt: now,
      ...(recipient.status === "expired" && {
        status: "pending",
        expirationNotifiedAt: undefined,
      }),
    });
  }
}

function buildSentDocumentPatch(document: Doc<"documents">, args: MarkDocumentAsSentArgs) {
  const now = Date.now();

  return {
    status: "active" as const,
    workflowStatus: "sent" as const,
    sentAt: now,
    updatedAt: now,
    ...(document.workflowStatus === "expired" && { expiredAt: undefined }),
    ...(args.deadline && { deadline: args.deadline }),
    ...(args.signingMode && { signingMode: args.signingMode }),
    ...(args.allowDictateNextSigner !== undefined && {
      allowDictateNextSigner: args.allowDictateNextSigner,
    }),
    ...(args.expirationPeriod && { expirationPeriod: args.expirationPeriod }),
  };
}

async function resetExpiredRecipientForResend(
  ctx: ActionCtx,
  documentId: Id<"documents">,
  recipient: Doc<"document_recipients">,
) {
  if (recipient.status !== "expired") {
    return undefined;
  }

  const latestDocument = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId,
  });
  const expiresAt = latestDocument?.expirationPeriod
    ? Date.now() +
      expirationPeriodToMs(
        latestDocument.expirationPeriod.amount,
        latestDocument.expirationPeriod.unit,
      )
    : undefined;

  await ctx.runMutation(internal.documents.send_document_action.resetExpiredRecipient, {
    recipientId: recipient._id,
    expiresAt,
  });

  if (latestDocument?.workflowStatus === "expired") {
    await ctx.runMutation(internal.documents.send_document_action.reactivateExpiredDocument, {
      documentId,
    });
  }

  return expiresAt;
}

async function authorizeDocumentOwner(
  ctx: ActionCtx,
  documentId: Id<"documents">,
): Promise<{ document: Doc<"documents">; userId: Id<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByAuthSubject, {
    authSubject: identity.subject,
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
    userId: v.optional(v.string()), // auth subject for audit trail
    signingMode: v.optional(v.union(v.literal("parallel"), v.literal("sequential"))),
    allowDictateNextSigner: v.optional(v.boolean()),
    expirationPeriod: v.optional(
      v.object({
        amount: v.number(),
        unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
      }),
    ),
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

    await shareDocumentWithRecipients(ctx, document, recipients, args.documentId);
    await applyRecipientExpirationPeriod(ctx, recipients, args.expirationPeriod);
    await ctx.db.patch(args.documentId, buildSentDocumentPatch(document, args));

    // Audit trail
    if (args.userId) {
      await logDocumentAction(ctx, {
        organizationId: document.organizationId,
        userId: args.userId,
        action: "document.sent",
        documentId: args.documentId,
        newValues: { workflowStatus: "sent" },
        description: "Document sent to recipients",
        ipAddress: "web-authenticated",
      });
    }

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      organizationId: document.organizationId,
      eventType: "document.sent",
      data: {
        document_id: args.documentId,
        name: document.name,
        recipient_count: recipients.length,
        sent_at: new Date().toISOString(),
      },
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
    recipientMessages: v.optional(
      v.array(
        v.object({
          recipientId: v.id("document_recipients"),
          message: v.string(),
        }),
      ),
    ), // SEA-119: Per-recipient custom messages
    deadline: v.optional(v.number()), // SEA-119: Signing deadline timestamp
    signingMode: v.optional(v.union(v.literal("parallel"), v.literal("sequential"))),
    allowDictateNextSigner: v.optional(v.boolean()),
    expirationPeriod: v.optional(
      v.object({
        amount: v.number(),
        unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
      }),
    ),
  },
  handler: async (ctx, args): Promise<SendDocumentEmailsResult> => {
    const { document, userId } = await authorizeDocumentOwner(ctx, args.documentId);
    const recipients = await getRecipientsOrThrow(ctx, args.documentId);
    const paymentInvoiceLinks = await getPaymentInvoiceLinksForDocument(ctx, {
      documentId: args.documentId,
      organizationId: document.organizationId,
      userId,
    });
    const { senderUser, senderName, emailBranding } = await getSenderEmailContext(
      ctx,
      userId,
      document.organizationId,
    );
    const emailDeadline = getEmailDeadline(args.deadline, args.expirationPeriod);
    const emailResults = await sendInvitationBatch(ctx, {
      recipients: getRecipientsToEmail(document, recipients),
      documentName: document.name,
      documentId: document._id,
      organizationId: document.organizationId,
      senderName,
      customMessage: args.customMessage,
      recipientMessageMap: buildRecipientMessageMap(args.recipientMessages),
      emailBranding,
      paymentInvoiceLinks,
      deadline: emailDeadline,
    });
    const result = buildSendDocumentEmailsResult(recipients, emailResults);

    // 8. Mark document as sent only when all emails succeed so edits remain possible on failures
    if (result.success) {
      await ctx.runMutation(internal.documents.send_document_action.markDocumentAsSent, {
        documentId: args.documentId,
        deadline: emailDeadline,
        userId: senderUser?.authSubject,
        signingMode: args.signingMode,
        allowDictateNextSigner: args.allowDictateNextSigner,
        expirationPeriod: args.expirationPeriod,
      });
    }

    return result;
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
    const { document, userId } = await authorizeDocumentOwner(ctx, args.documentId);

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
    if (recipient.status === "signed" || recipient.status === "approved") {
      return {
        success: false,
        error: `Cannot resend - recipient has already ${recipient.status}`,
      };
    }

    const newExpiresAt = await resetExpiredRecipientForResend(ctx, args.documentId, recipient);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
    const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;
    const { senderName, emailBranding } = await getSenderEmailContext(
      ctx,
      userId,
      document.organizationId,
    );
    const emailExpiresAt =
      recipient.status === "expired"
        ? newExpiresAt
        : recipient.expiresAt || recipient.tokenExpiresAt;

    const emailResult = await sendDocumentInvitation(ctx, {
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: document.name,
      senderName,
      signingUrl,
      customMessage: args.customMessage,
      expiresAt: emailExpiresAt,
      branding: emailBranding,
      organizationId: document.organizationId,
      documentId: document._id,
      recipientId: recipient._id,
    });

    return {
      success: emailResult.success,
      error: emailResult.error,
    };
  },
});

/**
 * Internal action to send document invitation emails without auth checks.
 * Used by the REST API after the mutation has already verified permissions.
 */
export const sendDocumentEmailsInternal = internalAction({
  args: {
    documentId: v.id("documents"),
    customMessage: v.optional(v.string()),
    expirationPeriod: v.optional(
      v.object({
        amount: v.number(),
        unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
      }),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get document
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId },
    );

    if (!document) return;

    // Get recipients
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );

    if (recipients.length === 0) return;

    const { senderName, emailBranding } = await getSenderEmailContext(
      ctx,
      document.ownerId,
      document.organizationId,
    );
    const paymentInvoiceLinks = await getPaymentInvoiceLinksForDocument(ctx, {
      documentId: args.documentId,
      organizationId: document.organizationId,
      userId: document.ownerId,
    });

    await sendInvitationBatch(ctx, {
      recipients: getRecipientsToEmail(document, recipients),
      documentName: document.name,
      documentId: document._id,
      organizationId: document.organizationId,
      senderName,
      customMessage: args.customMessage,
      recipientMessageMap: new Map(),
      emailBranding,
      paymentInvoiceLinks,
      deadline: undefined,
    });
  },
});

/**
 * Reset an expired recipient's status back to pending with new expiration.
 */
export const resetExpiredRecipient = internalMutation({
  args: {
    recipientId: v.id("document_recipients"),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recipientId, {
      status: "pending",
      expiresAt: args.expiresAt,
      expirationNotifiedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Transition an expired document back to "sent" status for re-sending.
 */
export const reactivateExpiredDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.workflowStatus !== "expired") return;

    await ctx.db.patch(args.documentId, {
      workflowStatus: "sent",
      sentAt: Date.now(),
      expiredAt: undefined,
      updatedAt: Date.now(),
    });
  },
});
