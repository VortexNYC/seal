import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";
import { getSubscriptionPlan } from "../auth/subscription_guards";
import {
  createVortexBillingCheckoutSessionDetails,
  resolveVortexBillingConfig,
} from "../payments/vortex_billing_processor";
import { resolveSubscriptionPriceAndProductByAnyId } from "../subscription_price_resolver";
import { seedTestOrganizationMember } from "../testVortexAuth";

type SeedVortexSaasBillingCatalogProjectionResult = {
  readonly organizationId: Id<"organizations">;
  readonly ownerId: Id<"users">;
  readonly subscriptionProductId: Id<"subscription_products">;
  readonly subscriptionPriceId: Id<"subscription_prices">;
};

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

type SeedVortexWebhookProofPaymentConfigResult = {
  readonly organizationId: Id<"organizations">;
  readonly ownerId: Id<"users">;
  readonly documentId: Id<"documents">;
  readonly recipientId: Id<"document_recipients">;
  readonly fieldId: Id<"signature_fields">;
  readonly configId: Id<"payment_field_configs">;
  readonly vortexPayableId: string;
};

type VortexSaasBillingProofState = {
  readonly organizationId: Id<"organizations">;
  readonly organizationBillingCustomerId: string | null;
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
    readonly latestInvoiceStatus: string | undefined;
    readonly latestInvoiceId: string | undefined;
  } | null;
  readonly product: {
    readonly externalProductId: string;
    readonly vortexProductId: string | undefined;
    readonly tier: string | undefined;
    readonly features: string | undefined;
  } | null;
  readonly price: {
    readonly externalPriceId: string;
    readonly vortexPriceId: string | undefined;
    readonly lookupKey: string | undefined;
    readonly currency: string;
    readonly unitAmount: number | undefined;
  } | null;
  readonly activeStripeIdPresent: boolean;
};

type VortexWebhookProofPaymentState = {
  readonly configId: Id<"payment_field_configs"> | undefined;
  readonly documentId: Id<"documents"> | undefined;
  readonly paymentStatus: string | undefined;
  readonly configProviderInvoiceId: string | undefined;
  readonly configProviderSubscriptionId: string | undefined;
  readonly configProviderPaymentIntentId: string | undefined;
  readonly vortexPayableId: string | undefined;
  readonly vortexPaymentRequestId: string | undefined;
  readonly hostedInvoiceUrl: string | undefined;
  readonly documentWorkflowStatus: string | undefined;
  readonly invoiceStatus: string | undefined;
  readonly invoiceProvider: string | undefined;
  readonly invoiceProviderInvoiceId: string | undefined;
  readonly invoiceProviderSubscriptionId: string | undefined;
  readonly invoiceProviderCustomerId: string | undefined;
  readonly invoiceProviderAccountId: string | undefined;
  readonly invoiceVortexPayableId: string | undefined;
  readonly invoiceVortexPaymentRequestId: string | undefined;
  readonly invoiceHostedUrl: string | undefined;
  readonly invoicePaidAt: number | undefined;
  readonly invoiceDunningStatus: string | undefined;
  readonly invoiceDunningStep: number | undefined;
  readonly invoiceDunningStartedAt: number | undefined;
  readonly invoiceNextDunningAt: number | undefined;
  readonly invoiceDunningCompletedAt: number | undefined;
};

type CreateVortexDocumentPayableProofObjectsResult = {
  readonly paymentLinks: {
    readonly recipientEmail: string;
    readonly hostedInvoiceUrl: string | null;
    readonly providerInvoiceId: string;
    readonly totalAmountCents: number;
    readonly currency: string;
  }[];
};

type VortexMerchantProofState = {
  readonly provider: "stripe" | "vortex" | undefined;
  readonly vortexMerchantAccountId: string | undefined;
  readonly chargesEnabled: boolean | undefined;
  readonly payoutsEnabled: boolean | undefined;
  readonly requirements:
    | {
        readonly currentlyDue: string[];
        readonly eventuallyDue: string[];
        readonly pastDue: string[];
        readonly disabledReason?: string;
      }
    | undefined;
};

type CreateVortexMerchantProofAccountResult = {
  readonly merchantAccountId: string;
  readonly state: {
    readonly chargesEnabled: boolean;
    readonly payoutsEnabled: boolean;
    readonly detailsSubmitted: boolean;
    readonly requirements: {
      readonly currentlyDue: string[];
      readonly eventuallyDue: string[];
      readonly pastDue: string[];
      readonly disabledReason?: string;
    };
    readonly capabilities: {
      readonly cardPayments: string;
      readonly transfers: string;
      readonly usBankAccountAchPayments?: string;
    };
  };
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
  billingCustomerId?: string,
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

export const ensureSealVortexOnboardingProofOrganization = internalMutation({
  args: {
    proofRunId: v.string(),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    slug: v.string(),
    ownerAuthSubject: v.string(),
  }),
  handler: async (ctx, args): Promise<EnsureSealVortexOnboardingProofOrganizationResult> => {
    const now = Date.now();
    const slug = `seal-vortex-onboarding-proof-${args.proofRunId}`.toLowerCase();
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
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", ownerAuthSubject))
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

    const organization = await ctx.db.get(organizationId);
    await ctx.db.patch(ownerId, {
      activeOrganizationId: organizationId,
      ...(organization?.vortexAuthOrganizationId !== undefined
        ? { activeVortexAuthOrganizationId: organization.vortexAuthOrganizationId }
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

function hasStripePrefix(value: string | undefined): boolean {
  return value !== undefined && /^(cus|sub|price|prod)_/u.test(value);
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
    latestInvoiceStatus: subscription.latestInvoiceStatus,
    latestInvoiceId: subscription.latestInvoiceId,
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
    vortexProductId: product.vortexProductId,
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
    vortexPriceId: price.vortexPriceId,
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
    billingCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SeedVortexSaasBillingCatalogProjectionResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      args.proofRunId,
      now,
      args.billingCustomerId,
    );
    const ownerId = await insertSaasProofOwner(ctx, args.proofRunId, organizationId);
    const subscriptionProductId = await ctx.db.insert("subscription_products", {
      externalProductId: args.vortexProductId,
      vortexProductId: args.vortexProductId,
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
      vortexPriceId: args.vortexPriceId,
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

export const seedStripeEntitlementSafetyProof = internalMutation({
  args: {
    proofRunId: v.string(),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    externalPriceId: v.string(),
    externalSubscriptionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const externalProductId = `prod_catalog_safety_${args.proofRunId}`;
    const externalPriceId = `price_catalog_safety_${args.proofRunId}`;
    const externalSubscriptionId = `sub_catalog_safety_${args.proofRunId}`;
    const organizationId = await insertSaasProofOrganization(
      ctx,
      `catalog-safety-${args.proofRunId}`,
      now,
      `cus_catalog_safety_${args.proofRunId}`,
    );
    const ownerId = await insertSaasProofOwner(
      ctx,
      `catalog-safety-${args.proofRunId}`,
      organizationId,
    );
    await seedTestOrganizationMember(ctx, {
      organizationId,
      userId: ownerId,
      role: "owner",
      status: "active",
    });

    const subscriptionProductId = await ctx.db.insert("subscription_products", {
      externalProductId,
      name: "Stripe Safety Control Pro",
      status: "archived",
      metadata: {
        tier: "pro",
        useType: "business",
        features: "api_access,webhook_access",
      },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("subscription_prices", {
      externalPriceId,
      externalProductId,
      subscriptionProductId,
      type: "recurring",
      billingScheme: "per_unit",
      currency: "usd",
      recurring: { interval: "month", intervalCount: 1 },
      unitAmount: 2900,
      usageType: "licensed",
      status: "archived",
      lookupKey: `catalog-safety:${args.proofRunId}`,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("subscriptions", {
      organizationId,
      externalCustomerId: `cus_catalog_safety_${args.proofRunId}`,
      externalSubscriptionId,
      externalPriceId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      externalPriceId,
      externalSubscriptionId,
    };
  },
});

async function archiveProductsByExternalProductIdRange(
  ctx: Pick<MutationCtx, "db">,
  args: { readonly lower: string; readonly upper: string; readonly now: number },
): Promise<number> {
  let archived = 0;
  const products = await ctx.db
    .query("subscription_products")
    .withIndex("by_external_product_id", (q) =>
      q.gte("externalProductId", args.lower).lt("externalProductId", args.upper),
    )
    .collect();

  for (const product of products) {
    if (product.status !== "archived") {
      await ctx.db.patch(product._id, { status: "archived", updatedAt: args.now });
      archived++;
    }
  }

  return archived;
}

async function archivePricesByLookupKeyRange(
  ctx: Pick<MutationCtx, "db">,
  args: { readonly lower: string; readonly upper: string; readonly now: number },
): Promise<number> {
  let archived = 0;
  const prices = await ctx.db
    .query("subscription_prices")
    .withIndex("by_lookup_key", (q) => q.gte("lookupKey", args.lower).lt("lookupKey", args.upper))
    .collect();

  for (const price of prices) {
    if (price.status !== "archived") {
      await ctx.db.patch(price._id, { status: "archived", updatedAt: args.now });
      archived++;
    }
  }

  return archived;
}

async function archivePricesByExternalPriceIdRange(
  ctx: Pick<MutationCtx, "db">,
  args: { readonly lower: string; readonly upper: string; readonly now: number },
): Promise<number> {
  let archived = 0;
  const prices = await ctx.db
    .query("subscription_prices")
    .withIndex("by_external_price_id", (q) =>
      q.gte("externalPriceId", args.lower).lt("externalPriceId", args.upper),
    )
    .collect();

  for (const price of prices) {
    if (price.status !== "archived") {
      await ctx.db.patch(price._id, { status: "archived", updatedAt: args.now });
      archived++;
    }
  }

  return archived;
}

export const archiveCatalogSafetyProofRows = internalMutation({
  args: {},
  returns: v.object({
    productsArchived: v.number(),
    pricesArchived: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const productsArchived =
      (await archiveProductsByExternalProductIdRange(ctx, {
        lower: "prod_catalog_safety_",
        upper: "prod_catalog_safety`",
        now,
      })) +
      (await archiveProductsByExternalProductIdRange(ctx, {
        lower: "vtx_prod_seal_coupon_proof_",
        upper: "vtx_prod_seal_coupon_proof_~",
        now,
      }));

    const pricesArchived =
      (await archivePricesByLookupKeyRange(ctx, {
        lower: "catalog-safety:",
        upper: "catalog-safety;",
        now,
      })) +
      (await archivePricesByExternalPriceIdRange(ctx, {
        lower: "vtx_price_seal_coupon_proof_",
        upper: "vtx_price_seal_coupon_proof_~",
        now,
      }));

    return { productsArchived, pricesArchived };
  },
});

export const seedVortexOneTimeDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexOneTimeDocumentPayableProofDocumentResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      `one-time-document-${args.proofRunId}`,
      now,
    );
    const ownerId = await insertSaasProofOwner(
      ctx,
      `one-time-document-${args.proofRunId}`,
      organizationId,
    );
    const documentId = await ctx.db.insert("documents", {
      organizationId,
      ownerId,
      name: `Vortex one-time document payable proof ${args.proofRunId}`,
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: `vortex-one-time-document-proof-${args.proofRunId}`,
      sharingMode: "private",
      status: "active",
      workflowStatus: "draft",
      signingMode: "parallel",
      createdAt: now,
      updatedAt: now,
    });
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId,
      email: args.recipientEmail,
      name: "Vortex One-Time Proof Recipient",
      role: "signer",
      status: "pending",
      order: 1,
      signingToken: `vortex-one-time-proof-token-${args.proofRunId}`,
      tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });
    const signatureFieldId = await ctx.db.insert("signature_fields", {
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
    const paymentFieldId = await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "One-time payment",
      isRequired: true,
      x: 10,
      y: 24,
      width: 35,
      height: 10,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });
    const paymentConfigId = await ctx.db.insert("payment_field_configs", {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      paymentType: "one_time",
      items: [
        {
          id: args.lineItemId,
          description: "Vortex one-time document payable proof",
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
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      paymentConfigId,
      configId: paymentConfigId,
      recipientEmail: args.recipientEmail,
      lineItemId: args.lineItemId,
    };
  },
});

export const markVortexDocumentPayableProofWaitingForPayment = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.object({
    documentId: v.id("documents"),
    recipientIds: v.array(v.id("document_recipients")),
    paymentConfigIds: v.array(v.id("payment_field_configs")),
    workflowStatus: v.literal("waiting_for_payment"),
  }),
  handler: async (ctx, args): Promise<MarkVortexDocumentPayableProofWaitingForPaymentResult> => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error(`Document ${args.documentId} not found`);
    }

    const now = Date.now();
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    const paymentConfigs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const recipient of recipients) {
      if (recipient.status !== "signed") {
        await ctx.db.patch(recipient._id, {
          status: "signed",
          signedAt: recipient.signedAt ?? now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.documentId, {
      workflowStatus: "waiting_for_payment",
      updatedAt: now,
    });

    return {
      documentId: args.documentId,
      recipientIds: recipients.map((recipient) => recipient._id),
      paymentConfigIds: paymentConfigs.map((config) => config._id),
      workflowStatus: "waiting_for_payment",
    };
  },
});

export const seedVortexRecurringDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexRecurringDocumentPayableProofDocumentResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      `recurring-document-${args.proofRunId}`,
      now,
    );
    const ownerId = await insertSaasProofOwner(
      ctx,
      `recurring-document-${args.proofRunId}`,
      organizationId,
    );
    const documentId = await ctx.db.insert("documents", {
      organizationId,
      ownerId,
      name: `Vortex recurring document payable proof ${args.proofRunId}`,
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: `vortex-recurring-document-proof-${args.proofRunId}`,
      sharingMode: "private",
      status: "active",
      workflowStatus: "draft",
      signingMode: "parallel",
      createdAt: now,
      updatedAt: now,
    });
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId,
      email: args.recipientEmail,
      name: "Vortex Recurring Proof Recipient",
      role: "signer",
      status: "pending",
      order: 1,
      signingToken: `vortex-recurring-proof-token-${args.proofRunId}`,
      tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });
    const signatureFieldId = await ctx.db.insert("signature_fields", {
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
    const paymentFieldId = await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Recurring payment",
      isRequired: true,
      x: 10,
      y: 24,
      width: 35,
      height: 10,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });
    const paymentConfigId = await ctx.db.insert("payment_field_configs", {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      paymentType: "recurring",
      items: [
        {
          id: args.lineItemId,
          description: "Vortex recurring document payable proof",
          quantity: 1,
          unitPrice: 4200,
        },
      ],
      currency: "usd",
      dueDateTerms: "net_30",
      recurringConfig: {
        interval: "month",
        intervalCount: 1,
        endCondition: "after_count",
        endAfterCount: 2,
      },
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents: 4200,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      paymentConfigId,
      configId: paymentConfigId,
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
  handler: async (ctx, args): Promise<SeedVortexInstallmentDocumentPayableProofDocumentResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      `installment-document-${args.proofRunId}`,
      now,
    );
    const ownerId = await insertSaasProofOwner(
      ctx,
      `installment-document-${args.proofRunId}`,
      organizationId,
    );
    const documentId = await ctx.db.insert("documents", {
      organizationId,
      ownerId,
      name: `Vortex installment document payable proof ${args.proofRunId}`,
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: `vortex-installment-document-proof-${args.proofRunId}`,
      sharingMode: "private",
      status: "active",
      workflowStatus: "draft",
      signingMode: "parallel",
      createdAt: now,
      updatedAt: now,
    });
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId,
      email: args.recipientEmail,
      name: "Vortex Installment Proof Recipient",
      role: "signer",
      status: "pending",
      order: 1,
      signingToken: `vortex-installment-proof-token-${args.proofRunId}`,
      tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });
    const signatureFieldId = await ctx.db.insert("signature_fields", {
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
    const paymentFieldId = await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Installment payment",
      isRequired: true,
      x: 10,
      y: 24,
      width: 35,
      height: 10,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });
    const paymentConfigId = await ctx.db.insert("payment_field_configs", {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      paymentType: "installments",
      items: [
        {
          id: args.lineItemId,
          description: "Vortex installment document payable proof",
          quantity: 3,
          unitPrice: 4200,
        },
      ],
      currency: "usd",
      dueDateTerms: "net_30",
      installmentsConfig: {
        count: 3,
        interval: "month",
      },
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents: 12600,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      paymentConfigId,
      configId: paymentConfigId,
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
  handler: async (
    ctx,
    args,
  ): Promise<SeedVortexDepositBalanceDocumentPayableProofDocumentResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      `deposit-balance-document-${args.proofRunId}`,
      now,
    );
    const ownerId = await insertSaasProofOwner(
      ctx,
      `deposit-balance-document-${args.proofRunId}`,
      organizationId,
    );
    const documentId = await ctx.db.insert("documents", {
      organizationId,
      ownerId,
      name: `Vortex deposit balance document payable proof ${args.proofRunId}`,
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: `vortex-deposit-balance-document-proof-${args.proofRunId}`,
      sharingMode: "private",
      status: "active",
      workflowStatus: "draft",
      signingMode: "parallel",
      createdAt: now,
      updatedAt: now,
    });
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId,
      email: args.recipientEmail,
      name: "Vortex Deposit Balance Proof Recipient",
      role: "signer",
      status: "pending",
      order: 1,
      signingToken: `vortex-deposit-balance-proof-token-${args.proofRunId}`,
      tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });
    const signatureFieldId = await ctx.db.insert("signature_fields", {
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
    const paymentFieldId = await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Deposit balance payment",
      isRequired: true,
      x: 10,
      y: 24,
      width: 35,
      height: 10,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });
    const paymentConfigId = await ctx.db.insert("payment_field_configs", {
      fieldId: paymentFieldId,
      documentId,
      organizationId,
      paymentType: "deposit_balance",
      items: [
        {
          id: args.lineItemId,
          description: "Vortex deposit balance document payable proof",
          quantity: 1,
          unitPrice: 20000,
        },
      ],
      currency: "usd",
      dueDateTerms: "net_30",
      depositBalanceConfig: {
        depositPercent: 25,
        balanceDueDays: 30,
      },
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents: 20000,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return {
      organizationId,
      ownerId,
      documentId,
      recipientId,
      signatureFieldId,
      paymentFieldId,
      paymentConfigId,
      configId: paymentConfigId,
      recipientEmail: args.recipientEmail,
      lineItemId: args.lineItemId,
    };
  },
});

export const seedVortexWebhookProofPaymentConfig = internalMutation({
  args: {
    proofRunId: v.string(),
    vortexPayableId: v.string(),
    vortexPaymentRequestId: v.string(),
    hostedInvoiceUrl: v.string(),
  },
  handler: async (ctx, args): Promise<SeedVortexWebhookProofPaymentConfigResult> => {
    const now = Date.now();
    const organizationId = await insertSaasProofOrganization(
      ctx,
      `webhook-document-${args.proofRunId}`,
      now,
    );
    const ownerId = await insertSaasProofOwner(
      ctx,
      `webhook-document-${args.proofRunId}`,
      organizationId,
    );
    const documentId = await ctx.db.insert("documents", {
      organizationId,
      ownerId,
      name: `Vortex webhook document payment proof ${args.proofRunId}`,
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: `vortex-webhook-document-proof-${args.proofRunId}`,
      sharingMode: "private",
      status: "active",
      workflowStatus: "waiting_for_payment",
      signingMode: "parallel",
      createdAt: now,
      updatedAt: now,
    });
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId,
      email: `vortex-webhook-recipient+${args.proofRunId}@seal.test`,
      name: "Vortex Webhook Proof Recipient",
      role: "signer",
      status: "signed",
      order: 1,
      signingToken: `vortex-webhook-proof-token-${args.proofRunId}`,
      tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });
    const fieldId = await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Document payment",
      isRequired: true,
      x: 10,
      y: 24,
      width: 35,
      height: 10,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });
    const configId = await ctx.db.insert("payment_field_configs", {
      fieldId,
      documentId,
      organizationId,
      paymentType: "one_time",
      items: [
        {
          id: `vortex-webhook-proof-line-${args.proofRunId}`,
          description: "Vortex webhook document payment proof",
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
      paymentStatus: "awaiting",
      vortexPayableId: args.vortexPayableId,
      vortexPaymentRequestId: args.vortexPaymentRequestId,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("document_invoices", {
      documentId,
      organizationId,
      provider: "vortex_billing",
      vortexPayableId: args.vortexPayableId,
      vortexPaymentRequestId: args.vortexPaymentRequestId,
      status: "open",
      customerEmail: `vortex-webhook-recipient+${args.proofRunId}@seal.test`,
      customerName: "Vortex Webhook Proof Recipient",
      amountDue: 4200,
      currency: "usd",
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      finalizedAt: now,
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

export const getVortexSaasBillingProofState = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<VortexSaasBillingProofState> => {
    const organization = await ctx.db.get(args.organizationId);
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
        .first()) ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "past_due"),
        )
        .first());
    const { price, product } =
      subscription === null
        ? { price: null, product: null }
        : await resolveSubscriptionPriceAndProductByAnyId(ctx.db, subscription.externalPriceId);

    return {
      organizationId: args.organizationId,
      organizationBillingCustomerId: organization?.billingCustomerId ?? null,
      plan,
      subscription: toProofSubscription(subscription),
      product: toProofProduct(product),
      price: toProofPrice(price),
      activeStripeIdPresent: hasActiveStripeId(subscription, product),
    };
  },
});

export const createVortexSaasCheckoutProofSession = internalAction({
  args: {
    organizationId: v.string(),
    lookupKey: v.string(),
    quantity: v.number(),
    promoCode: v.optional(v.string()),
    priceUnitAmount: v.optional(v.number()),
    apiBaseUrl: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    billingAccountId: v.optional(v.string()),
    priceId: v.optional(v.string()),
  },
  returns: v.object({
    checkoutUrl: v.string(),
    amountTotal: v.number(),
    amountRemaining: v.number(),
    invoiceNumbers: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    const explicitEnv =
      args.apiBaseUrl !== undefined &&
      args.apiKey !== undefined &&
      args.billingAccountId !== undefined &&
      args.priceId !== undefined
        ? {
            ...process.env,
            VORTEX_BILLING_API_BASE_URL: args.apiBaseUrl,
            VORTEX_BILLING_API_KEY: args.apiKey,
            VORTEX_BILLING_ACCOUNT_ID: args.billingAccountId,
            VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ [args.lookupKey]: args.priceId }),
          }
        : process.env;
    const checkoutSession = await createVortexBillingCheckoutSessionDetails(args, explicitEnv);
    return {
      checkoutUrl: checkoutSession.checkoutUrl,
      amountTotal: checkoutSession.amountTotal,
      amountRemaining: checkoutSession.amountRemaining,
      invoiceNumbers: [...checkoutSession.invoiceNumbers],
    };
  },
});

export const resolveVortexSaasBillingProofRefs = internalAction({
  args: {
    organizationId: v.string(),
    lookupKey: v.string(),
    priceId: v.string(),
    billingAccountId: v.string(),
    apiBaseUrl: v.string(),
    apiKey: v.string(),
  },
  returns: v.object({
    customerExternalId: v.string(),
    subscriptionExternalId: v.string(),
    billingAccountId: v.string(),
    priceId: v.string(),
  }),
  handler: async (_ctx, args) => {
    // V8 Convex actions do not expose deployment env vars via process.env, so pass the
    // Vortex api config explicitly (the proof reads it from its own local env).
    const config = resolveVortexBillingConfig(
      {
        organizationId: args.organizationId,
        lookupKey: args.lookupKey,
        quantity: 1,
      },
      {
        ...process.env,
        VORTEX_BILLING_API_BASE_URL: args.apiBaseUrl,
        VORTEX_BILLING_API_KEY: args.apiKey,
        VORTEX_BILLING_ACCOUNT_ID: args.billingAccountId,
        VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ [args.lookupKey]: args.priceId }),
      },
    );
    return {
      customerExternalId: config.customerExternalId,
      subscriptionExternalId: config.subscriptionExternalId,
      billingAccountId: config.billingAccountId,
      priceId: config.priceId,
    };
  },
});

export const getVortexCatalogProofPrice = internalQuery({
  args: {
    vortexPriceId: v.string(),
  },
  returns: v.union(
    v.object({
      externalPriceId: v.string(),
      vortexPriceId: v.optional(v.string()),
      externalProductId: v.string(),
      vortexProductId: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
      currency: v.string(),
      unitAmount: v.optional(v.number()),
      recurring: v.optional(
        v.object({
          interval: v.string(),
          intervalCount: v.number(),
        }),
      ),
      productName: v.string(),
      productStatus: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const { price, product } = await resolveSubscriptionPriceAndProductByAnyId(
      ctx.db,
      args.vortexPriceId,
    );
    if (price === null || product === null) {
      return null;
    }

    return {
      externalPriceId: price.externalPriceId,
      vortexPriceId: price.vortexPriceId,
      externalProductId: price.externalProductId,
      vortexProductId: product.vortexProductId,
      status: price.status,
      currency: price.currency,
      unitAmount: price.unitAmount,
      recurring: price.recurring,
      productName: product.name,
      productStatus: product.status,
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
      .first();
    const invoice = await ctx.db
      .query("document_invoices")
      .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", args.vortexPayableId))
      .first();
    const documentId = config?.documentId ?? invoice?.documentId;
    const document = documentId === undefined ? null : await ctx.db.get(documentId);

    return {
      configId: config?._id,
      documentId,
      paymentStatus: config?.paymentStatus,
      configProviderInvoiceId: config?.providerInvoiceId,
      configProviderSubscriptionId: config?.providerSubscriptionId,
      configProviderPaymentIntentId: config?.providerPaymentIntentId,
      vortexPayableId: config?.vortexPayableId,
      vortexPaymentRequestId: config?.vortexPaymentRequestId,
      hostedInvoiceUrl: config?.hostedInvoiceUrl,
      documentWorkflowStatus: document?.workflowStatus,
      invoiceStatus: invoice?.status,
      invoiceProvider: invoice?.provider,
      invoiceProviderInvoiceId: invoice?.providerInvoiceId,
      invoiceProviderSubscriptionId: invoice?.providerSubscriptionId,
      invoiceProviderCustomerId: invoice?.providerCustomerId,
      invoiceProviderAccountId: invoice?.providerAccountId,
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

export const createVortexDocumentPayableProofObjects = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.object({
    paymentLinks: v.array(
      v.object({
        recipientEmail: v.string(),
        hostedInvoiceUrl: v.union(v.string(), v.null()),
        providerInvoiceId: v.string(),
        totalAmountCents: v.number(),
        currency: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<CreateVortexDocumentPayableProofObjectsResult> => {
    return await ctx.runAction(
      internal.vortex_billing.payable_actions.createVortexPaymentObjectsForDocumentFields,
      args,
    );
  },
});

export const createVortexMerchantProofAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    merchantAccountId: v.string(),
    state: v.object({
      chargesEnabled: v.boolean(),
      payoutsEnabled: v.boolean(),
      detailsSubmitted: v.boolean(),
      requirements: v.object({
        currentlyDue: v.array(v.string()),
        eventuallyDue: v.array(v.string()),
        pastDue: v.array(v.string()),
        disabledReason: v.optional(v.string()),
      }),
      capabilities: v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      }),
    }),
  }),
  handler: async (ctx, args): Promise<CreateVortexMerchantProofAccountResult> => {
    return await ctx.runAction(
      internal.payments.vortex_merchant_actions.createVortexMerchantProofAccount,
      args,
    );
  },
});

export const forceRefreshVortexMerchantProofState = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    status: v.union(v.literal("not_connected"), v.literal("refreshed")),
  }),
  handler: async (ctx, args): Promise<{ readonly status: "not_connected" | "refreshed" }> => {
    return await ctx.runAction(
      internal.payments.vortex_merchant_actions.refreshVortexMerchantProofAccount,
      args,
    );
  },
});

export const getVortexMerchantProofState = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<VortexMerchantProofState> => {
    const account = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    return {
      provider: account?.provider,
      vortexMerchantAccountId: account?.vortexMerchantAccountId,
      chargesEnabled: account?.chargesEnabled,
      payoutsEnabled: account?.payoutsEnabled,
      requirements: account?.requirements,
    };
  },
});
