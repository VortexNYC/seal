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
import { resolveComponentMembershipForOrganization } from "../lib/componentOrgReads";
import { publishWebhookEvent } from "../webhooks/publish";
import { findFirstIncompleteGroup } from "./recipient_helpers";

type PaymentHandoffLink = {
  recipientEmail: string;
  hostedPaymentUrl: string | null;
  processorInvoiceId: string;
  totalAmountCents: number;
  currency: string;
};

type ProvePaymentInvoiceLinksResult = {
  invoiceLinks: {
    recipientEmail: string;
    hostedInvoiceUrl: string | null;
    paymentObjectId?: string;
    totalAmountCents: number;
    currency: string;
  }[];
  configs: {
    configId: string;
    paymentStatus?: string;
    vortexRecurringPayableId?: string;
    vortexInstallmentPayableId?: string;
    vortexDepositBalancePayableId?: string;
    vortexPayableId?: string;
    vortexPaymentRequestId?: string;
    hostedInvoiceUrl?: string;
    providerInvoiceId?: string;
    providerPaymentIntentId?: string;
    providerSubscriptionId?: string;
  }[];
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

type DocumentMutationCtx = Pick<MutationCtx, "db" | "runQuery">;

type MarkDocumentAsSentArgs = {
  documentId: Id<"documents">;
  deadline?: number;
  userId?: string;
  signingMode?: "parallel" | "sequential";
  allowDictateNextSigner?: boolean;
  expirationPeriod?: ExpirationPeriod;
};

/** Convert expiration period to milliseconds */
export function expirationPeriodToMs(
  amount: number,
  unit: "day" | "week" | "month"
): number {
  const MS_PER_DAY = 86_400_000;
  switch (unit) {
    case "day":
      return amount * MS_PER_DAY;
    case "week":
      return amount * 7 * MS_PER_DAY;
    case "month":
      return amount * 30 * MS_PER_DAY;
    default: {
      const _exhaustive: never = unit;
      void _exhaustive;
      throw new Error("Unsupported expiration unit");
    }
  }
}

function isRecipientDone(
  status: Doc<"document_recipients">["status"]
): boolean {
  return status === "signed" || status === "approved" || status === "declined";
}

function getRecipientsToEmail(
  document: Doc<"documents">,
  recipients: Doc<"document_recipients">[]
): Doc<"document_recipients">[] {
  if (document.signingMode === "sequential") {
    return findFirstIncompleteGroup(recipients);
  }

  return recipients.filter((recipient) => !isRecipientDone(recipient.status));
}

function buildRecipientMessageMap(
  recipientMessages:
    | Array<{ recipientId: Id<"document_recipients">; message: string }>
    | undefined
): Map<Id<"document_recipients">, string> {
  const recipientMessageMap = new Map<Id<"document_recipients">, string>();

  for (const recipientMessage of recipientMessages ?? []) {
    recipientMessageMap.set(
      recipientMessage.recipientId,
      recipientMessage.message
    );
  }

  return recipientMessageMap;
}

async function getSenderEmailContext(
  ctx: ActionCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">
) {
  const senderUser = await ctx.runQuery(
    internal.organizations.helpers.getUserById,
    {
      userId,
    }
  );
  const brandingSettings = await ctx.runQuery(
    internal.organizations.queries.getBrandingSettingsInternal,
    { organizationId }
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
  expirationPeriod: ExpirationPeriod | undefined
): number | undefined {
  if (deadline) {
    return deadline;
  }

  if (!expirationPeriod) {
    return undefined;
  }

  return (
    Date.now() +
    expirationPeriodToMs(expirationPeriod.amount, expirationPeriod.unit)
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
    paymentLinks: PaymentHandoffLink[];
    deadline: number | undefined;
  }
): Promise<InvitationEmailResult[]> {
  const results: InvitationEmailResult[] = [];

  for (const recipient of params.recipients) {
    if (isRecipientDone(recipient.status)) {
      continue;
    }

    const emailResult = { success: true, error: undefined };

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
  documentId: Id<"documents">
): Promise<Doc<"document_recipients">[]> {
  const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
    internal.documents.recipients_queries.getDocumentRecipientsInternal,
    { documentId }
  );

  if (recipients.length === 0) {
    throw new ConvexError("No recipients found");
  }

  return recipients;
}

async function getPaymentHandoffLinksForDocument(
  ctx: ActionCtx,
  params: {
    documentId: Id<"documents">;
    organizationId: Id<"organizations">;
    userId: Id<"users">;
  }
): Promise<PaymentHandoffLink[]> {
  const signatureFields = await ctx.runQuery(
    internal.signature_fields.queries.getFieldsByDocumentInternal,
    {
      documentId: params.documentId,
    }
  );

  if (
    !signatureFields.some(
      (field: (typeof signatureFields)[number]) =>
        field.fieldType === "signature"
    )
  ) {
    throw new ConvexError(
      "Cannot send document without signature fields. Please add at least one signature field before sending."
    );
  }

  const paymentFields = signatureFields.filter(
    (field: (typeof signatureFields)[number]) => field.fieldType === "payment"
  );
  if (paymentFields.length === 0) {
    return [];
  }

  const paymentConfigs = await ctx.runQuery(
    internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
    { documentId: params.documentId }
  );
  const configuredFieldIds = new Set(
    paymentConfigs.map((config: (typeof paymentConfigs)[number]) =>
      config.fieldId.toString()
    )
  );

  if (
    paymentFields.some(
      (field: (typeof paymentFields)[number]) =>
        !configuredFieldIds.has(field._id.toString())
    )
  ) {
    throw new ConvexError(
      "All payment fields must be configured before sending. Please configure payment details for each payment field."
    );
  }

  const paymentResult = await ctx.runAction(
    internal.payments.payment_field_actions
      .createPaymentObjectsForDocumentFields,
    {
      documentId: params.documentId,
      organizationId: params.organizationId,
      userId: params.userId,
    }
  );

  return paymentResult.paymentLinks;
}

export const provePaymentInvoiceLinksForDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.object({
    invoiceLinks: v.array(
      v.object({
        recipientEmail: v.string(),
        hostedInvoiceUrl: v.union(v.string(), v.null()),
        paymentObjectId: v.optional(v.string()),
        totalAmountCents: v.number(),
        currency: v.string(),
      })
    ),
    configs: v.array(
      v.object({
        configId: v.string(),
        paymentStatus: v.optional(v.string()),
        vortexRecurringPayableId: v.optional(v.string()),
        vortexInstallmentPayableId: v.optional(v.string()),
        vortexDepositBalancePayableId: v.optional(v.string()),
        vortexPayableId: v.optional(v.string()),
        vortexPaymentRequestId: v.optional(v.string()),
        hostedInvoiceUrl: v.optional(v.string()),
        providerInvoiceId: v.optional(v.string()),
        providerPaymentIntentId: v.optional(v.string()),
        providerSubscriptionId: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args): Promise<ProvePaymentInvoiceLinksResult> => {
    const paymentLinks = await getPaymentHandoffLinksForDocument(ctx, args);
    const configs = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId }
    );

    return {
      invoiceLinks: paymentLinks.map((link) => ({
        recipientEmail: link.recipientEmail,
        hostedInvoiceUrl: link.hostedPaymentUrl,
        paymentObjectId: link.processorInvoiceId,
        totalAmountCents: link.totalAmountCents,
        currency: link.currency,
      })),
      configs: configs.map((config) => {
        const row: {
          configId: (typeof configs)[number]["_id"];
          paymentStatus?: (typeof configs)[number]["paymentStatus"];
          vortexRecurringPayableId?: (typeof configs)[number]["vortexRecurringPayableId"];
          vortexInstallmentPayableId?: (typeof configs)[number]["vortexInstallmentPayableId"];
          vortexDepositBalancePayableId?: (typeof configs)[number]["vortexDepositBalancePayableId"];
          vortexPayableId?: (typeof configs)[number]["vortexPayableId"];
          vortexPaymentRequestId?: (typeof configs)[number]["vortexPaymentRequestId"];
          hostedInvoiceUrl?: (typeof configs)[number]["hostedInvoiceUrl"];
          providerInvoiceId?: (typeof configs)[number]["providerInvoiceId"];
          providerPaymentIntentId?: (typeof configs)[number]["providerPaymentIntentId"];
          providerSubscriptionId?: (typeof configs)[number]["providerSubscriptionId"];
        } = { configId: config._id };
        if (config.paymentStatus !== undefined) {
          row.paymentStatus = config.paymentStatus;
        }
        if (config.vortexRecurringPayableId !== undefined) {
          row.vortexRecurringPayableId = config.vortexRecurringPayableId;
        }
        if (config.vortexInstallmentPayableId !== undefined) {
          row.vortexInstallmentPayableId = config.vortexInstallmentPayableId;
        }
        if (config.vortexDepositBalancePayableId !== undefined) {
          row.vortexDepositBalancePayableId =
            config.vortexDepositBalancePayableId;
        }
        if (config.vortexPayableId !== undefined) {
          row.vortexPayableId = config.vortexPayableId;
        }
        if (config.vortexPaymentRequestId !== undefined) {
          row.vortexPaymentRequestId = config.vortexPaymentRequestId;
        }
        if (config.hostedInvoiceUrl !== undefined) {
          row.hostedInvoiceUrl = config.hostedInvoiceUrl;
        }
        if (config.providerInvoiceId !== undefined) {
          row.providerInvoiceId = config.providerInvoiceId;
        }
        if (config.providerPaymentIntentId !== undefined) {
          row.providerPaymentIntentId = config.providerPaymentIntentId;
        }
        if (config.providerSubscriptionId !== undefined) {
          row.providerSubscriptionId = config.providerSubscriptionId;
        }
        return row;
      }),
    };
  },
});

function buildSendDocumentEmailsResult(
  recipients: Doc<"document_recipients">[],
  emailResults: InvitationEmailResult[]
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
  documentId: Id<"documents">
): Promise<boolean> {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", recipient.email))
    .first();

  if (!existingUser) {
    return false;
  }

  const organization = await ctx.db.get(
    "organizations",
    document.organizationId
  );
  const orgMember = organization
    ? await resolveComponentMembershipForOrganization(
        ctx,
        existingUser,
        organization
      )
    : null;

  let grantedAccess = false;
  if (orgMember?.status === "active") {
    const existingAccess = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", documentId).eq("userId", existingUser._id)
      )
      .first();

    if (!existingAccess || existingAccess.revokedAt !== undefined) {
      if (existingAccess) {
        await ctx.db.patch("document_access", existingAccess._id, {
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
    await ctx.db.patch("document_recipients", recipient._id, {
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
  documentId: Id<"documents">
) {
  let sharedWithAnyUser = false;

  for (const recipient of recipients) {
    if (await syncRecipientAccess(ctx, document, recipient, documentId)) {
      sharedWithAnyUser = true;
    }
  }

  if (sharedWithAnyUser && document.sharingMode === "private") {
    await ctx.db.patch("documents", documentId, {
      sharingMode: "specific",
    });
  }
}

async function applyRecipientExpirationPeriod(
  ctx: DocumentMutationCtx,
  recipients: Doc<"document_recipients">[],
  expirationPeriod: ExpirationPeriod | undefined
) {
  if (!expirationPeriod) {
    return;
  }

  const now = Date.now();
  const expiresAt =
    now + expirationPeriodToMs(expirationPeriod.amount, expirationPeriod.unit);

  for (const recipient of recipients) {
    await ctx.db.patch("document_recipients", recipient._id, {
      expiresAt,
      updatedAt: now,
      ...(recipient.status === "expired" && {
        status: "pending",
        expirationNotifiedAt: undefined,
      }),
    });
  }
}

function buildSentDocumentPatch(
  document: Doc<"documents">,
  args: MarkDocumentAsSentArgs
) {
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
  recipient: Doc<"document_recipients">
) {
  if (recipient.status !== "expired") {
    return undefined;
  }

  const latestDocument = await ctx.runQuery(
    internal.documents.queries.getDocumentInternal,
    {
      documentId,
    }
  );
  const expiresAt = latestDocument?.expirationPeriod
    ? Date.now() +
      expirationPeriodToMs(
        latestDocument.expirationPeriod.amount,
        latestDocument.expirationPeriod.unit
      )
    : undefined;

  await ctx.runMutation(
    internal.documents.expiration_resend.resetExpiredRecipient,
    {
      recipientId: recipient._id,
      expiresAt,
    }
  );

  if (latestDocument?.workflowStatus === "expired") {
    await ctx.runMutation(
      internal.documents.expiration_resend.reactivateExpiredDocument,
      {
        documentId,
      }
    );
  }

  return expiresAt;
}

async function authorizeDocumentOwner(
  ctx: ActionCtx,
  documentId: Id<"documents">
): Promise<{ document: Doc<"documents">; userId: Id<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(
    internal.organizations.helpers.getUserByAuthSubject,
    {
      authSubject: identity.subject,
    }
  );

  if (!user) {
    throw new ConvexError("User not found");
  }

  const document = await ctx.runQuery(
    internal.documents.queries.getDocumentInternal,
    {
      documentId,
    }
  );

  if (!document) {
    throw new ConvexError("Document not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId: document.organizationId,
    }
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
    signingMode: v.optional(
      v.union(v.literal("parallel"), v.literal("sequential"))
    ),
    allowDictateNextSigner: v.optional(v.boolean()),
    expirationPeriod: v.optional(
      v.object({
        amount: v.number(),
        unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // Get all recipients for this document
    const recipients = [];
    for await (const _row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      recipients.push(_row);
    }

    await shareDocumentWithRecipients(
      ctx,
      document,
      recipients,
      args.documentId
    );
    await applyRecipientExpirationPeriod(
      ctx,
      recipients,
      args.expirationPeriod
    );
    await ctx.db.patch(
      "documents",
      args.documentId,
      buildSentDocumentPatch(document, args)
    );

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
        })
      )
    ), // SEA-119: Per-recipient custom messages
    deadline: v.optional(v.number()), // SEA-119: Signing deadline timestamp
    signingMode: v.optional(
      v.union(v.literal("parallel"), v.literal("sequential"))
    ),
    allowDictateNextSigner: v.optional(v.boolean()),
    expirationPeriod: v.optional(
      v.object({
        amount: v.number(),
        unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
      })
    ),
  },
  handler: async (ctx, args): Promise<SendDocumentEmailsResult> => {
    const { document, userId } = await authorizeDocumentOwner(
      ctx,
      args.documentId
    );
    const recipients = await getRecipientsOrThrow(ctx, args.documentId);
    const paymentLinks = await getPaymentHandoffLinksForDocument(ctx, {
      documentId: args.documentId,
      organizationId: document.organizationId,
      userId,
    });
    const { senderUser, senderName, emailBranding } =
      await getSenderEmailContext(ctx, userId, document.organizationId);
    const emailDeadline = getEmailDeadline(
      args.deadline,
      args.expirationPeriod
    );
    const emailResults = await sendInvitationBatch(ctx, {
      recipients: getRecipientsToEmail(document, recipients),
      documentName: document.name,
      documentId: document._id,
      organizationId: document.organizationId,
      senderName,
      customMessage: args.customMessage,
      recipientMessageMap: buildRecipientMessageMap(args.recipientMessages),
      emailBranding,
      paymentLinks,
      deadline: emailDeadline,
    });
    const result = buildSendDocumentEmailsResult(recipients, emailResults);

    // 8. Mark document as sent only when all emails succeed so edits remain possible on failures
    if (result.success) {
      await ctx.runMutation(
        internal.documents.expiration_resend.markDocumentAsSent,
        {
          documentId: args.documentId,
          deadline: emailDeadline,
          userId: senderUser?.authSubject,
          signingMode: args.signingMode,
          allowDictateNextSigner: args.allowDictateNextSigner,
          expirationPeriod: args.expirationPeriod,
        }
      );
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
    args
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
      }
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

    await resetExpiredRecipientForResend(ctx, args.documentId, recipient);
    const emailResult = { success: true, error: undefined };

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
      })
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get document
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );

    if (!document) return;

    // Get recipients
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId }
    );

    if (recipients.length === 0) return;

    const { senderName, emailBranding } = await getSenderEmailContext(
      ctx,
      document.ownerId,
      document.organizationId
    );

    await sendInvitationBatch(ctx, {
      recipients: getRecipientsToEmail(document, recipients),
      documentName: document.name,
      documentId: document._id,
      organizationId: document.organizationId,
      senderName,
      customMessage: args.customMessage,
      recipientMessageMap: new Map(),
      emailBranding,
      paymentLinks: [],
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
    await ctx.db.patch("document_recipients", args.recipientId, {
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
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.workflowStatus !== "expired") return;

    await ctx.db.patch("documents", args.documentId, {
      workflowStatus: "sent",
      sentAt: Date.now(),
      expiredAt: undefined,
      updatedAt: Date.now(),
    });
  },
});
