import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { getSubscriptionPlan } from "../auth/subscription_guards";

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

export const seedVortexRecurringDocumentPayableProofDocument = internalMutation({
  args: {
    proofRunId: v.string(),
    lineItemId: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<SeedVortexRecurringDocumentPayableProofDocumentResult> => {
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
