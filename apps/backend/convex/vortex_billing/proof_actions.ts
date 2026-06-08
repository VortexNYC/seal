import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";

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
    readonly now: number;
  },
): Promise<Id<"payment_field_configs">> {
  return await ctx.db.insert("payment_field_configs", {
    fieldId: input.fieldId,
    documentId: input.documentId,
    organizationId: input.organizationId,
    paymentType: "one_time",
    items: [
      {
        id: input.lineItemId,
        description: "Vortex send-flow proof payment",
        quantity: 1,
        unitPrice: 4200,
      },
    ],
    currency: "usd",
    dueDateTerms: "net_30",
    allowedPaymentMethods: ["card"],
    feeHandling: "absorb",
    taxEnabled: false,
    totalAmountCents: 4200,
    paymentStatus: "pending",
    createdAt: input.now,
    updatedAt: input.now,
  });
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
    const slug = `vortex-webhook-proof-${args.proofRunId}`.toLowerCase();
    const organizationId = await ctx.db.insert("organizations", {
      name: `Vortex Webhook Proof ${args.proofRunId}`,
      slug,
      type: "company",
      isActive: true,
      timezone: "UTC",
      updatedAt: now,
    });

    const ownerId = await ctx.db.insert("users", {
      email: `owner+${args.proofRunId}@seal.test`,
      name: "Vortex Webhook Proof Owner",
      authSubject: `vortex_webhook_proof_${args.proofRunId}`,
      isEmailVerified: true,
      timezone: "UTC",
      locale: "en-US",
      activeOrganizationId: organizationId,
    });

    const documentId = await ctx.db.insert("documents", {
      name: "Vortex Webhook Proof Document",
      ownerId,
      organizationId,
      status: "active",
      workflowStatus: "waiting_for_payment",
      sharingMode: "private",
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: `storage_${args.proofRunId}`,
      createdAt: now,
      updatedAt: now,
    });

    const recipientId = await ctx.db.insert("document_recipients", {
      documentId,
      email: `buyer+${args.proofRunId}@seal.test`,
      name: "Vortex Webhook Proof Buyer",
      role: "signer",
      status: "signed",
      signingToken: `token_${args.proofRunId}`,
      tokenExpiresAt: now + 86_400_000,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });

    const fieldId = await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Payment",
      isRequired: true,
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });

    const configId = await ctx.db.insert("payment_field_configs", {
      fieldId,
      documentId,
      organizationId,
      paymentType: "one_time",
      items: [{ id: "line_1", description: "Vortex proof payment", quantity: 1, unitPrice: 4200 }],
      currency: "usd",
      dueDateTerms: "net_30",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents: 4200,
      paymentStatus: "awaiting",
      vortexPayableId: args.vortexPayableId,
      vortexPaymentRequestId: args.vortexPaymentRequestId,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      createdAt: now,
      updatedAt: now,
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
    return {
      configId: config._id,
      documentId: config.documentId,
      paymentStatus: config.paymentStatus,
      vortexPayableId: config.vortexPayableId,
      vortexPaymentRequestId: config.vortexPaymentRequestId,
      hostedInvoiceUrl: config.hostedInvoiceUrl,
      documentWorkflowStatus: document?.workflowStatus,
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
