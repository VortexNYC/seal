import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { getSubscriptionPlan } from "../auth/subscription_guards";
import { resolveSaasCheckoutProviderForOrganization } from "./subscription_actions";

type SeedVortexWebhookProofResult = {
  readonly organizationId: Id<"organizations">;
  readonly ownerId: Id<"users">;
  readonly documentId: Id<"documents">;
  readonly recipientId: Id<"document_recipients">;
  readonly fieldId: Id<"signature_fields">;
  readonly configId: Id<"payment_field_configs">;
  readonly vortexPayableId: string;
};

type VortexWebhookProofPaymentState = {
  readonly configId: Id<"payment_field_configs">;
  readonly documentId: Id<"documents">;
  readonly paymentStatus: string | undefined;
  readonly vortexPayableId: string | undefined;
  readonly vortexPaymentRequestId: string | undefined;
  readonly hostedInvoiceUrl: string | undefined;
  readonly documentWorkflowStatus: string | undefined;
  readonly invoiceStatus: string | undefined;
  readonly invoiceProvider: string | undefined;
  readonly invoiceVortexPayableId: string | undefined;
  readonly invoiceVortexPaymentRequestId: string | undefined;
  readonly invoiceHostedUrl: string | undefined;
  readonly invoicePaidAt: number | undefined;
  readonly invoiceDunningStatus: string | undefined;
  readonly invoiceDunningStep: number | undefined;
  readonly invoiceDunningStartedAt: number | undefined;
  readonly invoiceNextDunningAt: number | undefined;
  readonly invoiceDunningCompletedAt: number | undefined;
} | null;

type SeedVortexSendFlowProofResult = {
  readonly organizationId: Id<"organizations">;
  readonly ownerId: Id<"users">;
  readonly documentId: Id<"documents">;
  readonly recipientId: Id<"document_recipients">;
  readonly signatureFieldId: Id<"signature_fields">;
  readonly paymentFieldId: Id<"signature_fields">;
  readonly configId: Id<"payment_field_configs">;
  readonly recipientEmail: string;
  readonly lineItemId: string;
};

type SeedVortexSaasBillingProjectionResult = {
  readonly organizationId: Id<"organizations">;
  readonly ownerId: Id<"users">;
  readonly subscriptionProductId: Id<"subscription_products">;
  readonly subscriptionPriceId: Id<"subscription_prices">;
  readonly subscriptionId: Id<"subscriptions">;
};

type SeedVortexSaasBillingCatalogProjectionResult = Omit<
  SeedVortexSaasBillingProjectionResult,
  "subscriptionId"
>;

type VortexSaasBillingProofState = {
  readonly organizationId: Id<"organizations">;
  readonly plan: {
    readonly isPro: boolean;
    readonly isEnterprise: boolean;
    readonly plan: string;
  };
  readonly subscription: {
    readonly externalCustomerId: string;
    readonly externalSubscriptionId: string;
    readonly externalPriceId: string;
    readonly status: string;
    readonly cancelAtPeriodEnd: boolean;
    readonly currentPeriodStart: number;
    readonly currentPeriodEnd: number;
  } | null;
  readonly product: {
    readonly externalProductId: string;
    readonly tier: string | undefined;
    readonly features: string | undefined;
  } | null;
  readonly price: {
    readonly externalPriceId: string;
    readonly lookupKey: string | undefined;
    readonly currency: string;
    readonly unitAmount: number | undefined;
  } | null;
  readonly activeStripeIdPresent: boolean;
};

type VortexSaasCheckoutCutoverGuardProofState = {
  readonly organizationId: Id<"organizations">;
  readonly provider: "vortex_billing" | "stripe";
  readonly stripeCustomerId: string | undefined;
  readonly stripeCustomerIdPresent: boolean;
};

async function insertWebhookProofOrganization(
  ctx: MutationCtx,
  proofRunId: string,
  now: number,
): Promise<Id<"organizations">> {
  const slug = `vortex-webhook-proof-${proofRunId}`.toLowerCase();
  return await ctx.db.insert("organizations", {
    name: `Vortex Webhook Proof ${proofRunId}`,
    slug,
    type: "company",
    isActive: true,
    timezone: "UTC",
    updatedAt: now,
  });
}

async function insertWebhookProofOwner(
  ctx: MutationCtx,
  proofRunId: string,
  organizationId: Id<"organizations">,
): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    email: `owner+${proofRunId}@seal.test`,
    name: "Vortex Webhook Proof Owner",
    authSubject: `vortex_webhook_proof_${proofRunId}`,
    isEmailVerified: true,
    timezone: "UTC",
    locale: "en-US",
    activeOrganizationId: organizationId,
  });
}

async function insertWebhookProofDocument(
  ctx: MutationCtx,
  input: {
    readonly proofRunId: string;
    readonly organizationId: Id<"organizations">;
    readonly ownerId: Id<"users">;
    readonly now: number;
  },
): Promise<Id<"documents">> {
  return await ctx.db.insert("documents", {
    name: "Vortex Webhook Proof Document",
    ownerId: input.ownerId,
    organizationId: input.organizationId,
    status: "active",
    workflowStatus: "waiting_for_payment",
    sharingMode: "private",
    fileSize: 1024,
    fileType: "application/pdf",
    storageId: `storage_${input.proofRunId}`,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertWebhookProofRecipient(
  ctx: MutationCtx,
  input: {
    readonly proofRunId: string;
    readonly documentId: Id<"documents">;
    readonly now: number;
  },
): Promise<Id<"document_recipients">> {
  return await ctx.db.insert("document_recipients", {
    documentId: input.documentId,
    email: `buyer+${input.proofRunId}@seal.test`,
    name: "Vortex Webhook Proof Buyer",
    role: "signer",
    status: "signed",
    signingToken: `token_${input.proofRunId}`,
    tokenExpiresAt: input.now + 86_400_000,
    order: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertWebhookProofPaymentField(
  ctx: MutationCtx,
  input: {
    readonly documentId: Id<"documents">;
    readonly recipientId: Id<"document_recipients">;
    readonly now: number;
  },
): Promise<Id<"signature_fields">> {
  return await ctx.db.insert("signature_fields", {
    documentId: input.documentId,
    recipientId: input.recipientId,
    fieldType: "payment",
    label: "Payment",
    isRequired: true,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    page: 1,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertWebhookProofPaymentConfig(
  ctx: MutationCtx,
  input: {
    readonly fieldId: Id<"signature_fields">;
    readonly documentId: Id<"documents">;
    readonly organizationId: Id<"organizations">;
    readonly vortexPayableId: string;
    readonly vortexPaymentRequestId: string | undefined;
    readonly hostedInvoiceUrl: string | undefined;
    readonly now: number;
  },
): Promise<Id<"payment_field_configs">> {
  return await ctx.db.insert("payment_field_configs", {
    fieldId: input.fieldId,
    documentId: input.documentId,
    organizationId: input.organizationId,
    paymentType: "one_time",
    items: [{ id: "line_1", description: "Vortex proof payment", quantity: 1, unitPrice: 4200 }],
    currency: "usd",
    dueDateTerms: "net_30",
    allowedPaymentMethods: ["card"],
    feeHandling: "absorb",
    taxEnabled: false,
    totalAmountCents: 4200,
    paymentStatus: "awaiting",
    vortexPayableId: input.vortexPayableId,
    vortexPaymentRequestId: input.vortexPaymentRequestId,
    hostedInvoiceUrl: input.hostedInvoiceUrl,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertWebhookProofInvoice(
  ctx: MutationCtx,
  input: {
    readonly proofRunId: string;
    readonly documentId: Id<"documents">;
    readonly organizationId: Id<"organizations">;
    readonly vortexPayableId: string;
    readonly vortexPaymentRequestId: string | undefined;
    readonly hostedInvoiceUrl: string | undefined;
    readonly now: number;
  },
): Promise<void> {
  await ctx.db.insert("document_invoices", {
    provider: "vortex_billing",
    documentId: input.documentId,
    organizationId: input.organizationId,
    vortexPayableId: input.vortexPayableId,
    vortexPaymentRequestId: input.vortexPaymentRequestId,
    status: "open",
    customerEmail: `buyer+${input.proofRunId}@seal.test`,
    customerName: "Vortex Webhook Proof Buyer",
    amountDue: 4200,
    currency: "usd",
    hostedInvoiceUrl: input.hostedInvoiceUrl,
    finalizedAt: input.now,
    dunningStatus: "none",
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertSendFlowProofOrganization(
  ctx: MutationCtx,
  proofRunId: string,
  now: number,
): Promise<Id<"organizations">> {
  const slug = `vortex-send-flow-proof-${proofRunId}`.toLowerCase();
  return await ctx.db.insert("organizations", {
    name: `Vortex Send Flow Proof ${proofRunId}`,
    slug,
    type: "company",
    isActive: true,
    timezone: "UTC",
    updatedAt: now,
  });
}

async function insertSendFlowProofOwner(
  ctx: MutationCtx,
  proofRunId: string,
  organizationId: Id<"organizations">,
): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    email: `send-flow-owner+${proofRunId}@seal.test`,
    name: "Vortex Send Flow Proof Owner",
    authSubject: `vortex_send_flow_proof_${proofRunId}`,
    isEmailVerified: true,
    timezone: "UTC",
    locale: "en-US",
    activeOrganizationId: organizationId,
  });
}

async function insertSendFlowProofDocument(
  ctx: MutationCtx,
  proofRunId: string,
  organizationId: Id<"organizations">,
  ownerId: Id<"users">,
  now: number,
): Promise<Id<"documents">> {
  return await ctx.db.insert("documents", {
    name: "Vortex Send Flow Proof Document",
    ownerId,
    organizationId,
    status: "active",
    workflowStatus: "draft",
    sharingMode: "private",
    fileSize: 1024,
    fileType: "application/pdf",
    storageId: `send_flow_storage_${proofRunId}`,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertSendFlowProofRecipient(
  ctx: MutationCtx,
  input: {
    readonly documentId: Id<"documents">;
    readonly recipientEmail: string;
    readonly proofRunId: string;
    readonly now: number;
  },
): Promise<Id<"document_recipients">> {
  return await ctx.db.insert("document_recipients", {
    documentId: input.documentId,
    email: input.recipientEmail,
    name: "Vortex Send Flow Proof Buyer",
    role: "signer",
    status: "pending",
    signingToken: `send_flow_token_${input.proofRunId}`,
    tokenExpiresAt: input.now + 86_400_000,
    order: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertSendFlowProofField(
  ctx: MutationCtx,
  input: {
    readonly documentId: Id<"documents">;
    readonly recipientId: Id<"document_recipients">;
    readonly fieldType: "signature" | "payment";
    readonly label: string;
    readonly y: number;
    readonly now: number;
  },
): Promise<Id<"signature_fields">> {
  return await ctx.db.insert("signature_fields", {
    documentId: input.documentId,
    recipientId: input.recipientId,
    fieldType: input.fieldType,
    label: input.label,
    isRequired: true,
    x: 0,
    y: input.y,
    width: 100,
    height: 40,
    page: 1,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertSendFlowProofPaymentConfig(
  ctx: MutationCtx,
  input: {
    readonly fieldId: Id<"signature_fields">;
    readonly documentId: Id<"documents">;
    readonly organizationId: Id<"organizations">;
    readonly lineItemId: string;
    readonly paymentType?: "one_time" | "recurring" | "installments" | "deposit_balance";
    readonly now: number;
  },
): Promise<Id<"payment_field_configs">> {
  const paymentType = input.paymentType ?? "one_time";
  const totalAmountCents =
    paymentType === "installments" ? 12600 : paymentType === "deposit_balance" ? 20000 : 4200;
  return await ctx.db.insert("payment_field_configs", {
    fieldId: input.fieldId,
    documentId: input.documentId,
    organizationId: input.organizationId,
    paymentType,
    items: [
      {
        id: input.lineItemId,
        description: "Vortex send-flow proof payment",
        quantity: 1,
        unitPrice: totalAmountCents,
      },
    ],
    currency: "usd",
    dueDateTerms: "net_30",
    ...(paymentType === "recurring"
      ? {
          recurringConfig: {
            interval: "month" as const,
            intervalCount: 1,
            endCondition: "after_count" as const,
            endAfterCount: 2,
          },
        }
      : {}),
    ...(paymentType === "installments"
      ? {
          installmentsConfig: {
            count: 3,
            interval: "month" as const,
          },
        }
      : {}),
    ...(paymentType === "deposit_balance"
      ? {
          depositBalanceConfig: {
            depositPercent: 25,
            balanceDueDays: 30,
          },
        }
      : {}),
    allowedPaymentMethods: ["card"],
    feeHandling: "absorb",
    taxEnabled: false,
    totalAmountCents,
    paymentStatus: "pending",
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function insertSaasProofOrganization(
  ctx: MutationCtx,
  proofRunId: string,
  now: number,
  stripeCustomerId?: string,
): Promise<Id<"organizations">> {
  return await ctx.db.insert("organizations", {
    name: `Vortex SaaS Billing Proof ${proofRunId}`,
    slug: `vortex-saas-billing-proof-${proofRunId}`.toLowerCase(),
    type: "company",
    isActive: true,
    timezone: "UTC",
    ...(stripeCustomerId !== undefined ? { stripeCustomerId } : {}),
    updatedAt: now,
  });
}

async function insertSaasProofOwner(
  ctx: MutationCtx,
  proofRunId: string,
  organizationId: Id<"organizations">,
): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    email: `saas-billing-owner+${proofRunId}@seal.test`,
    name: "Vortex SaaS Billing Proof Owner",
    authSubject: `vortex_saas_billing_proof_${proofRunId}`,
    isEmailVerified: true,
    timezone: "UTC",
    locale: "en-US",
    activeOrganizationId: organizationId,
  });
}

function hasStripePrefix(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return /^(cus|sub|price|prod)_/.test(value);
}

function toProofSubscription(
  subscription: Doc<"subscriptions"> | null,
): VortexSaasBillingProofState["subscription"] {
  if (subscription === null) {
    return null;
  }

  return {
    externalCustomerId: subscription.externalCustomerId,
    externalSubscriptionId: subscription.externalSubscriptionId,
    externalPriceId: subscription.externalPriceId,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

function toProofProduct(
  product: Doc<"subscription_products"> | null,
): VortexSaasBillingProofState["product"] {
  if (product === null) {
    return null;
  }

  return {
    externalProductId: product.externalProductId,
    tier: product.metadata?.tier,
    features: product.metadata?.features,
  };
}

function toProofPrice(
  price: Doc<"subscription_prices"> | null,
): VortexSaasBillingProofState["price"] {
  if (price === null) {
    return null;
  }

  return {
    externalPriceId: price.externalPriceId,
    lookupKey: price.lookupKey,
    currency: price.currency,
    unitAmount: price.unitAmount,
  };
}

function hasActiveStripeId(
  subscription: Doc<"subscriptions"> | null,
  product: Doc<"subscription_products"> | null,
): boolean {
  return (
    hasStripePrefix(subscription?.externalCustomerId) ||
    hasStripePrefix(subscription?.externalSubscriptionId) ||
    hasStripePrefix(subscription?.externalPriceId) ||
    hasStripePrefix(product?.externalProductId)
  );
}

export const seedVortexWebhookProofPaymentConfig = internalMutation({
  args: {
    proofRunId: v.string(),
    vortexPayableId: v.string(),
    vortexPaymentRequestId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SeedVortexWebhookProofResult> => {
    const now = Date.now();
    const organizationId = await insertWebhookProofOrganization(ctx, args.proofRunId, now);
    const ownerId = await insertWebhookProofOwner(ctx, args.proofRunId, organizationId);
    const documentId = await insertWebhookProofDocument(ctx, {
      proofRunId: args.proofRunId,
      organizationId,
      ownerId,
      now,
    });
    const recipientId = await insertWebhookProofRecipient(ctx, {
      proofRunId: args.proofRunId,
      documentId,
      now,
    });
    const fieldId = await insertWebhookProofPaymentField(ctx, {
      documentId,
      recipientId,
      now,
    });
    const configId = await insertWebhookProofPaymentConfig(ctx, {
      fieldId,
      documentId,
      organizationId,
      vortexPayableId: args.vortexPayableId,
      vortexPaymentRequestId: args.vortexPaymentRequestId,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      now,
    });
    await insertWebhookProofInvoice(ctx, {
      proofRunId: args.proofRunId,
      documentId,
      organizationId,
      vortexPayableId: args.vortexPayableId,
      vortexPaymentRequestId: args.vortexPaymentRequestId,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      fieldId,
      configId,
      vortexPayableId: args.vortexPayableId,
    };
  },
});

export const getVortexWebhookProofPaymentState = internalQuery({
  args: {
    vortexPayableId: v.string(),
  },
  handler: async (ctx, args): Promise<VortexWebhookProofPaymentState> => {
    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", args.vortexPayableId))
      .unique();

    if (!config) {
      return null;
    }

    const document = await ctx.db.get(config.documentId);
    const invoice = await ctx.db
      .query("document_invoices")
      .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", args.vortexPayableId))
      .first();
    return {
      configId: config._id,
      documentId: config.documentId,
      paymentStatus: config.paymentStatus,
      vortexPayableId: config.vortexPayableId,
      vortexPaymentRequestId: config.vortexPaymentRequestId,
      hostedInvoiceUrl: config.hostedInvoiceUrl,
      documentWorkflowStatus: document?.workflowStatus,
      invoiceStatus: invoice?.status,
      invoiceProvider: invoice?.provider,
      invoiceVortexPayableId: invoice?.vortexPayableId,
      invoiceVortexPaymentRequestId: invoice?.vortexPaymentRequestId,
      invoiceHostedUrl: invoice?.hostedInvoiceUrl,
      invoicePaidAt: invoice?.paidAt,
      invoiceDunningStatus: invoice?.dunningStatus,
      invoiceDunningStep: invoice?.dunningStep,
      invoiceDunningStartedAt: invoice?.dunningStartedAt,
      invoiceNextDunningAt: invoice?.nextDunningAt,
      invoiceDunningCompletedAt: invoice?.dunningCompletedAt,
    };
  },
});

export const seedVortexSendFlowProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexSendFlowProofResult> => {
    const now = Date.now();
    const organizationId = await insertSendFlowProofOrganization(ctx, args.proofRunId, now);
    const ownerId = await insertSendFlowProofOwner(ctx, args.proofRunId, organizationId);
    const documentId = await insertSendFlowProofDocument(
      ctx,
      args.proofRunId,
      organizationId,
      ownerId,
      now,
    );
    const recipientId = await insertSendFlowProofRecipient(ctx, {
      documentId,
      recipientEmail: args.recipientEmail,
      proofRunId: args.proofRunId,
      now,
    });
    const signatureFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "signature",
      label: "Signature",
      y: 0,
      now,
    });
    const paymentFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Payment",
      y: 60,
      now,
    });
    const configId = await insertSendFlowProofPaymentConfig(ctx, {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      lineItemId: args.lineItemId,
      now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      configId,
      recipientEmail: args.recipientEmail,
      lineItemId: args.lineItemId,
    };
  },
});

export const seedVortexRecurringDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexSendFlowProofResult> => {
    const now = Date.now();
    const organizationId = await insertSendFlowProofOrganization(ctx, args.proofRunId, now);
    const ownerId = await insertSendFlowProofOwner(ctx, args.proofRunId, organizationId);
    const documentId = await insertSendFlowProofDocument(
      ctx,
      args.proofRunId,
      organizationId,
      ownerId,
      now,
    );
    const recipientId = await insertSendFlowProofRecipient(ctx, {
      documentId,
      recipientEmail: args.recipientEmail,
      proofRunId: args.proofRunId,
      now,
    });
    const signatureFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "signature",
      label: "Signature",
      y: 0,
      now,
    });
    const paymentFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Recurring payment",
      y: 60,
      now,
    });
    const configId = await insertSendFlowProofPaymentConfig(ctx, {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      lineItemId: args.lineItemId,
      paymentType: "recurring",
      now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      configId,
      recipientEmail: args.recipientEmail,
      lineItemId: args.lineItemId,
    };
  },
});

export const seedVortexInstallmentDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexSendFlowProofResult> => {
    const now = Date.now();
    const organizationId = await insertSendFlowProofOrganization(ctx, args.proofRunId, now);
    const ownerId = await insertSendFlowProofOwner(ctx, args.proofRunId, organizationId);
    const documentId = await insertSendFlowProofDocument(
      ctx,
      args.proofRunId,
      organizationId,
      ownerId,
      now,
    );
    const recipientId = await insertSendFlowProofRecipient(ctx, {
      documentId,
      recipientEmail: args.recipientEmail,
      proofRunId: args.proofRunId,
      now,
    });
    const signatureFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "signature",
      label: "Signature",
      y: 0,
      now,
    });
    const paymentFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Installment payment",
      y: 60,
      now,
    });
    const configId = await insertSendFlowProofPaymentConfig(ctx, {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      lineItemId: args.lineItemId,
      paymentType: "installments",
      now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      configId,
      recipientEmail: args.recipientEmail,
      lineItemId: args.lineItemId,
    };
  },
});

export const seedVortexDepositBalanceDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexSendFlowProofResult> => {
    const now = Date.now();
    const organizationId = await insertSendFlowProofOrganization(ctx, args.proofRunId, now);
    const ownerId = await insertSendFlowProofOwner(ctx, args.proofRunId, organizationId);
    const documentId = await insertSendFlowProofDocument(
      ctx,
      args.proofRunId,
      organizationId,
      ownerId,
      now,
    );
    const recipientId = await insertSendFlowProofRecipient(ctx, {
      documentId,
      recipientEmail: args.recipientEmail,
      proofRunId: args.proofRunId,
      now,
    });
    const signatureFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "signature",
      label: "Signature",
      y: 0,
      now,
    });
    const paymentFieldId = await insertSendFlowProofField(ctx, {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Deposit and balance payment",
      y: 60,
      now,
    });
    const configId = await insertSendFlowProofPaymentConfig(ctx, {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      lineItemId: args.lineItemId,
      paymentType: "deposit_balance",
      now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      configId,
      recipientEmail: args.recipientEmail,
      lineItemId: args.lineItemId,
    };
  },
});

export const seedVortexSaasBillingProjection = internalMutation({
  args: {
    proofRunId: v.string(),
    vortexCustomerId: v.string(),
    vortexSubscriptionId: v.string(),
    vortexPriceId: v.string(),
    vortexProductId: v.string(),
    lookupKey: v.string(),
    tier: v.union(v.literal("pro"), v.literal("enterprise")),
    features: v.string(),
    unitAmount: v.number(),
    currency: v.string(),
    stripeCustomerId: v.optional(v.string()),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args): Promise<SeedVortexSaasBillingProjectionResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      args.proofRunId,
      now,
      args.stripeCustomerId,
    );
    const ownerId = await insertSaasProofOwner(ctx, args.proofRunId, organizationId);
    const subscriptionProductId = await ctx.db.insert("subscription_products", {
      externalProductId: args.vortexProductId,
      name: args.tier === "enterprise" ? "Vortex Enterprise" : "Vortex Pro",
      description: "Vortex-projected Seal SaaS billing proof product",
      status: "active",
      metadata: {
        tier: args.tier,
        useType: "business",
        features: args.features,
      },
      createdAt: now,
      updatedAt: now,
    });
    const subscriptionPriceId = await ctx.db.insert("subscription_prices", {
      externalPriceId: args.vortexPriceId,
      externalProductId: args.vortexProductId,
      subscriptionProductId,
      type: "recurring",
      billingScheme: "per_unit",
      currency: args.currency.toLowerCase(),
      recurring: { interval: "month", intervalCount: 1 },
      unitAmount: args.unitAmount,
      usageType: "licensed",
      status: "active",
      lookupKey: args.lookupKey,
      createdAt: now,
      updatedAt: now,
    });
    const subscriptionId = await ctx.db.insert("subscriptions", {
      organizationId,
      externalCustomerId: args.vortexCustomerId,
      externalSubscriptionId: args.vortexSubscriptionId,
      externalPriceId: args.vortexPriceId,
      status: "active",
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      ownerId,
      subscriptionProductId,
      subscriptionPriceId,
      subscriptionId,
    };
  },
});

export const seedVortexSaasBillingCatalogProjection = internalMutation({
  args: {
    proofRunId: v.string(),
    vortexPriceId: v.string(),
    vortexProductId: v.string(),
    lookupKey: v.string(),
    tier: v.union(v.literal("pro"), v.literal("enterprise")),
    features: v.string(),
    unitAmount: v.number(),
    currency: v.string(),
    stripeCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SeedVortexSaasBillingCatalogProjectionResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      args.proofRunId,
      now,
      args.stripeCustomerId,
    );
    const ownerId = await insertSaasProofOwner(ctx, args.proofRunId, organizationId);
    const subscriptionProductId = await ctx.db.insert("subscription_products", {
      externalProductId: args.vortexProductId,
      name: args.tier === "enterprise" ? "Vortex Enterprise" : "Vortex Pro",
      description: "Vortex-projected Seal SaaS billing proof product",
      status: "active",
      metadata: {
        tier: args.tier,
        useType: "business",
        features: args.features,
      },
      createdAt: now,
      updatedAt: now,
    });
    const subscriptionPriceId = await ctx.db.insert("subscription_prices", {
      externalPriceId: args.vortexPriceId,
      externalProductId: args.vortexProductId,
      subscriptionProductId,
      type: "recurring",
      billingScheme: "per_unit",
      currency: args.currency.toLowerCase(),
      recurring: { interval: "month", intervalCount: 1 },
      unitAmount: args.unitAmount,
      usageType: "licensed",
      status: "active",
      lookupKey: args.lookupKey,
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      ownerId,
      subscriptionProductId,
      subscriptionPriceId,
    };
  },
});

export const getVortexSaasCheckoutCutoverGuardProofState = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    enabledOrganizationIdsRaw: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexSaasCheckoutCutoverGuardProofState> => {
    const organization = await ctx.db.get(args.organizationId);
    if (organization === null) {
      throw new Error("Organization not found");
    }

    const provider = resolveSaasCheckoutProviderForOrganization(
      args.organizationId,
      args.enabledOrganizationIdsRaw,
    );

    return {
      organizationId: args.organizationId,
      provider,
      stripeCustomerId: organization.stripeCustomerId,
      stripeCustomerIdPresent: organization.stripeCustomerId !== undefined,
    };
  },
});

export const getVortexSaasBillingProofState = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<VortexSaasBillingProofState> => {
    const plan = await getSubscriptionPlan(ctx.db, args.organizationId);
    const subscription =
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "active"),
        )
        .first()) ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "trialing"),
        )
        .first());

    const price =
      subscription === null
        ? null
        : await ctx.db
            .query("subscription_prices")
            .withIndex("by_external_price_id", (q) =>
              q.eq("externalPriceId", subscription.externalPriceId),
            )
            .first();
    const product =
      price === null
        ? null
        : await ctx.db
            .query("subscription_products")
            .withIndex("by_external_product_id", (q) =>
              q.eq("externalProductId", price.externalProductId),
            )
            .first();

    return {
      organizationId: args.organizationId,
      plan,
      subscription: toProofSubscription(subscription),
      product: toProofProduct(product),
      price: toProofPrice(price),
      activeStripeIdPresent: hasActiveStripeId(subscription, product),
    };
  },
});
