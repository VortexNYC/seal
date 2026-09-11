import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { seedTestOrganizationMember } from "../testVortexAuth";

type SeedVortexRecurringDocumentPayableProofDocumentResult = {
  readonly organizationId: Id<"organizations">;
  readonly ownerId: Id<"users">;
  readonly documentId: Id<"documents">;
  readonly recipientId: Id<"document_recipients">;
  readonly signatureFieldId: Id<"signature_fields">;
  readonly paymentFieldId: Id<"signature_fields">;
  readonly paymentConfigId: Id<"payment_field_configs">;
  readonly configId: Id<"payment_field_configs">;
  readonly recipientEmail: string;
  readonly lineItemId: string;
};

type SeedVortexInstallmentDocumentPayableProofDocumentResult =
  SeedVortexRecurringDocumentPayableProofDocumentResult;

type SeedVortexDepositBalanceDocumentPayableProofDocumentResult =
  SeedVortexRecurringDocumentPayableProofDocumentResult;

type SeedVortexOneTimeDocumentPayableProofDocumentResult =
  SeedVortexRecurringDocumentPayableProofDocumentResult;

type MarkVortexDocumentPayableProofWaitingForPaymentResult = {
  readonly documentId: Id<"documents">;
  readonly recipientIds: Id<"document_recipients">[];
  readonly paymentConfigIds: Id<"payment_field_configs">[];
  readonly workflowStatus: "waiting_for_payment";
};

type EnsureSealVortexOnboardingProofOrganizationResult = {
  readonly organizationId: Id<"organizations">;
  readonly slug: string;
  readonly ownerAuthSubject: string;
};

const sealVortexOnboardingProofIdentityIssuer = "seal-vortex-onboarding-proof";

async function insertSaasProofOrganization(
  ctx: MutationCtx,
  proofRunId: string,
  now: number,
  billingCustomerId?: string
): Promise<Id<"organizations">> {
  return await ctx.db.insert("organizations", {
    name: `Vortex SaaS Billing Proof ${proofRunId}`,
    slug: `vortex-saas-billing-proof-${proofRunId}`.toLowerCase(),
    type: "company",
    isActive: true,
    timezone: "UTC",
    ...(billingCustomerId !== undefined ? { billingCustomerId } : {}),
    updatedAt: now,
  });
}

async function insertSaasProofOwner(
  ctx: MutationCtx,
  proofRunId: string,
  organizationId: Id<"organizations">
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

export const ensureSealVortexOnboardingProofOrganization = internalMutation({
  args: {
    proofRunId: v.string(),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    slug: v.string(),
    ownerAuthSubject: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<EnsureSealVortexOnboardingProofOrganizationResult> => {
    const now = Date.now();
    const slug =
      `seal-vortex-onboarding-proof-${args.proofRunId}`.toLowerCase();
    const ownerAuthSubject = `seal_vortex_onboarding_proof_${args.proofRunId}`;
    const existingOrganization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    const organizationId =
      existingOrganization?._id ??
      (await ctx.db.insert("organizations", {
        name: `Seal Vortex Onboarding Proof ${args.proofRunId}`,
        slug,
        type: "company",
        isActive: true,
        status: "active",
        timezone: "UTC",
        updatedAt: now,
      }));

    const existingOwner = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", ownerAuthSubject)
      )
      .first();
    const ownerId =
      existingOwner?._id ??
      (await ctx.db.insert("users", {
        email: `vortex-onboarding-owner+${args.proofRunId}@seal.test`,
        name: "Seal Vortex Onboarding Proof Owner",
        authSubject: ownerAuthSubject,
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      }));

    await seedTestOrganizationMember(ctx, {
      organizationId,
      userId: ownerId,
      role: "owner",
      status: "active",
      identityIssuer: sealVortexOnboardingProofIdentityIssuer,
    });

    const organization = await ctx.db.get("organizations", organizationId);
    await ctx.db.patch("users", ownerId, {
      activeOrganizationId: organizationId,
      ...(organization?.vortexAuthOrganizationId !== undefined
        ? {
            activeVortexAuthOrganizationId:
              organization.vortexAuthOrganizationId,
          }
        : {}),
      updatedAt: now,
    });

    return {
      organizationId,
      slug,
      ownerAuthSubject,
    };
  },
});

type SeedVortexDocumentPayableProofInput = {
  readonly ctx: MutationCtx;
  readonly proofRunId: string;
  readonly lineItemId: string;
  readonly recipientEmail: string;
  readonly organizationProofPrefix: string;
  readonly documentName: string;
  readonly storageIdPrefix: string;
  readonly recipientName: string;
  readonly tokenPrefix: string;
  readonly paymentLabel: string;
  readonly paymentConfig: {
    readonly paymentType:
      | "one_time"
      | "recurring"
      | "installments"
      | "deposit_balance";
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly totalAmountCents: number;
    readonly recurringConfig?: {
      readonly interval: "month";
      readonly intervalCount: number;
      readonly endCondition: "after_count";
      readonly endAfterCount: number;
    };
    readonly installmentsConfig?: {
      readonly count: number;
      readonly interval: "month";
    };
    readonly depositBalanceConfig?: {
      readonly depositPercent: number;
      readonly balanceDueDays: number;
    };
  };
};

async function seedVortexDocumentPayableProofDocument(
  input: SeedVortexDocumentPayableProofInput
): Promise<SeedVortexRecurringDocumentPayableProofDocumentResult> {
  const now = Date.now();
  const organizationId = await insertSaasProofOrganization(
    input.ctx,
    `${input.organizationProofPrefix}-${input.proofRunId}`,
    now
  );
  const ownerId = await insertSaasProofOwner(
    input.ctx,
    `${input.organizationProofPrefix}-${input.proofRunId}`,
    organizationId
  );
  const documentId = await insertVortexProofDocument(
    input,
    organizationId,
    ownerId,
    now
  );
  const recipientId = await insertVortexProofRecipient(input, documentId, now);
  const signatureFieldId = await insertVortexProofSignatureField(
    input.ctx,
    documentId,
    recipientId,
    now
  );
  const paymentFieldId = await insertVortexProofPaymentField(
    input,
    documentId,
    recipientId,
    now
  );
  const paymentConfigId = await insertVortexProofPaymentConfig(
    input,
    documentId,
    organizationId,
    paymentFieldId,
    now
  );

  return {
    organizationId,
    ownerId,
    documentId,
    recipientId,
    signatureFieldId,
    paymentFieldId,
    paymentConfigId,
    configId: paymentConfigId,
    recipientEmail: input.recipientEmail,
    lineItemId: input.lineItemId,
  };
}

async function insertVortexProofDocument(
  input: SeedVortexDocumentPayableProofInput,
  organizationId: Id<"organizations">,
  ownerId: Id<"users">,
  now: number
): Promise<Id<"documents">> {
  return await input.ctx.db.insert("documents", {
    organizationId,
    ownerId,
    name: `${input.documentName} ${input.proofRunId}`,
    fileSize: 1024,
    fileType: "application/pdf",
    storageId: `${input.storageIdPrefix}-${input.proofRunId}`,
    sharingMode: "private",
    status: "active",
    workflowStatus: "draft",
    signingMode: "parallel",
    createdAt: now,
    updatedAt: now,
  });
}

async function insertVortexProofRecipient(
  input: SeedVortexDocumentPayableProofInput,
  documentId: Id<"documents">,
  now: number
): Promise<Id<"document_recipients">> {
  return await input.ctx.db.insert("document_recipients", {
    documentId,
    email: input.recipientEmail,
    name: input.recipientName,
    role: "signer",
    status: "pending",
    order: 1,
    signingToken: `${input.tokenPrefix}-${input.proofRunId}`,
    tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertVortexProofSignatureField(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  recipientId: Id<"document_recipients">,
  now: number
): Promise<Id<"signature_fields">> {
  return await ctx.db.insert("signature_fields", {
    documentId,
    recipientId,
    fieldType: "signature",
    label: "Signature",
    isRequired: true,
    isMainSignature: true,
    x: 10,
    y: 10,
    width: 25,
    height: 8,
    page: 1,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertVortexProofPaymentField(
  input: SeedVortexDocumentPayableProofInput,
  documentId: Id<"documents">,
  recipientId: Id<"document_recipients">,
  now: number
): Promise<Id<"signature_fields">> {
  return await input.ctx.db.insert("signature_fields", {
    documentId,
    recipientId,
    fieldType: "payment",
    label: input.paymentLabel,
    isRequired: true,
    x: 10,
    y: 24,
    width: 35,
    height: 10,
    page: 1,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertVortexProofPaymentConfig(
  input: SeedVortexDocumentPayableProofInput,
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
  paymentFieldId: Id<"signature_fields">,
  now: number
): Promise<Id<"payment_field_configs">> {
  return await input.ctx.db.insert("payment_field_configs", {
    fieldId: paymentFieldId,
    documentId,
    organizationId,
    paymentType: input.paymentConfig.paymentType,
    items: [
      {
        id: input.lineItemId,
        description: input.paymentConfig.description,
        quantity: input.paymentConfig.quantity,
        unitPrice: input.paymentConfig.unitPrice,
      },
    ],
    currency: "usd",
    dueDateTerms: "net_30",
    ...(input.paymentConfig.recurringConfig
      ? { recurringConfig: input.paymentConfig.recurringConfig }
      : {}),
    ...(input.paymentConfig.installmentsConfig
      ? { installmentsConfig: input.paymentConfig.installmentsConfig }
      : {}),
    ...(input.paymentConfig.depositBalanceConfig
      ? { depositBalanceConfig: input.paymentConfig.depositBalanceConfig }
      : {}),
    allowedPaymentMethods: ["card"],
    feeHandling: "absorb",
    taxEnabled: false,
    totalAmountCents: input.paymentConfig.totalAmountCents,
    paymentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });
}

export const seedVortexOneTimeDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<SeedVortexOneTimeDocumentPayableProofDocumentResult> => {
    return await seedVortexDocumentPayableProofDocument({
      ctx,
      proofRunId: args.proofRunId,
      lineItemId: args.lineItemId,
      recipientEmail: args.recipientEmail,
      organizationProofPrefix: "one-time-document",
      documentName: "Vortex one-time document payable proof",
      storageIdPrefix: "vortex-one-time-document-proof",
      recipientName: "Vortex One-Time Proof Recipient",
      tokenPrefix: "vortex-one-time-proof-token",
      paymentLabel: "One-time payment",
      paymentConfig: {
        paymentType: "one_time",
        description: "Vortex one-time document payable proof",
        quantity: 1,
        unitPrice: 4200,
        totalAmountCents: 4200,
      },
    });
  },
});

export const markVortexDocumentPayableProofWaitingForPayment = internalMutation(
  {
    args: {
      documentId: v.id("documents"),
    },
    returns: v.object({
      documentId: v.id("documents"),
      recipientIds: v.array(v.id("document_recipients")),
      paymentConfigIds: v.array(v.id("payment_field_configs")),
      workflowStatus: v.literal("waiting_for_payment"),
    }),
    handler: async (
      ctx,
      args
    ): Promise<MarkVortexDocumentPayableProofWaitingForPaymentResult> => {
      const document = await ctx.db.get("documents", args.documentId);
      if (!document) {
        throw new Error(`Document ${args.documentId} not found`);
      }

      const now = Date.now();
      const recipientIds: Id<"document_recipients">[] = [];
      for await (const recipient of ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
        recipientIds.push(recipient._id);
        if (recipient.status !== "signed") {
          await ctx.db.patch("document_recipients", recipient._id, {
            status: "signed",
            signedAt: recipient.signedAt ?? now,
            updatedAt: now,
          });
        }
      }

      const paymentConfigIds: Id<"payment_field_configs">[] = [];
      for await (const config of ctx.db
        .query("payment_field_configs")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
        paymentConfigIds.push(config._id);
      }

      await ctx.db.patch("documents", args.documentId, {
        workflowStatus: "waiting_for_payment",
        updatedAt: now,
      });

      return {
        documentId: args.documentId,
        recipientIds,
        paymentConfigIds,
        workflowStatus: "waiting_for_payment",
      };
    },
  }
);

export const seedVortexRecurringDocumentPayableProofDocument = internalMutation(
  {
    args: {
      proofRunId: v.string(),
      lineItemId: v.string(),
      recipientEmail: v.string(),
    },
    handler: async (
      ctx,
      args
    ): Promise<SeedVortexRecurringDocumentPayableProofDocumentResult> => {
      return await seedVortexDocumentPayableProofDocument({
        ctx,
        proofRunId: args.proofRunId,
        lineItemId: args.lineItemId,
        recipientEmail: args.recipientEmail,
        organizationProofPrefix: "recurring-document",
        documentName: "Vortex recurring document payable proof",
        storageIdPrefix: "vortex-recurring-document-proof",
        recipientName: "Vortex Recurring Proof Recipient",
        tokenPrefix: "vortex-recurring-proof-token",
        paymentLabel: "Recurring payment",
        paymentConfig: {
          paymentType: "recurring",
          description: "Vortex recurring document payable proof",
          quantity: 1,
          unitPrice: 4200,
          totalAmountCents: 4200,
          recurringConfig: {
            interval: "month",
            intervalCount: 1,
            endCondition: "after_count",
            endAfterCount: 2,
          },
        },
      });
    },
  }
);

export const seedVortexInstallmentDocumentPayableProofDocument =
  internalMutation({
    args: {
      proofRunId: v.string(),
      lineItemId: v.string(),
      recipientEmail: v.string(),
    },
    handler: async (
      ctx,
      args
    ): Promise<SeedVortexInstallmentDocumentPayableProofDocumentResult> => {
      return await seedVortexDocumentPayableProofDocument({
        ctx,
        proofRunId: args.proofRunId,
        lineItemId: args.lineItemId,
        recipientEmail: args.recipientEmail,
        organizationProofPrefix: "installment-document",
        documentName: "Vortex installment document payable proof",
        storageIdPrefix: "vortex-installment-document-proof",
        recipientName: "Vortex Installment Proof Recipient",
        tokenPrefix: "vortex-installment-proof-token",
        paymentLabel: "Installment payment",
        paymentConfig: {
          paymentType: "installments",
          description: "Vortex installment document payable proof",
          quantity: 3,
          unitPrice: 4200,
          totalAmountCents: 12600,
          installmentsConfig: {
            count: 3,
            interval: "month",
          },
        },
      });
    },
  });

export const seedVortexDepositBalanceDocumentPayableProofDocument =
  internalMutation({
    args: {
      proofRunId: v.string(),
      lineItemId: v.string(),
      recipientEmail: v.string(),
    },
    handler: async (
      ctx,
      args
    ): Promise<SeedVortexDepositBalanceDocumentPayableProofDocumentResult> => {
      return await seedVortexDocumentPayableProofDocument({
        ctx,
        proofRunId: args.proofRunId,
        lineItemId: args.lineItemId,
        recipientEmail: args.recipientEmail,
        organizationProofPrefix: "deposit-balance-document",
        documentName: "Vortex deposit balance document payable proof",
        storageIdPrefix: "vortex-deposit-balance-document-proof",
        recipientName: "Vortex Deposit Balance Proof Recipient",
        tokenPrefix: "vortex-deposit-balance-proof-token",
        paymentLabel: "Deposit balance payment",
        paymentConfig: {
          paymentType: "deposit_balance",
          description: "Vortex deposit balance document payable proof",
          quantity: 1,
          unitPrice: 20000,
          totalAmountCents: 20000,
          depositBalanceConfig: {
            depositPercent: 25,
            balanceDueDays: 30,
          },
        },
      });
    },
  });
