"use node";
/**
 * Stripe actions for Payment Field Builder.
 *
 * Creates Stripe Invoice objects on the connected account for each
 * payment field config when a document is sent.
 *
 * Flow per payment config:
 * 1) Create Products + Prices for each line item
 * 2) Create an Invoice with those line items
 * 3) Finalize the invoice to generate hosted_invoice_url
 * 4) Store Stripe IDs back on the payment_field_config row
 */
import { ConvexError, v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { getOrCreateConnectedCustomer } from "./connect_helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Platform fee rates for Seal.
 * Free tier: 1%, Pro tier: 0.25%
 */
const PLATFORM_FEE_RATES = {
  free: 0.01,
  pro: 0.0025,
} as const;

/** @internal Exported for testing only. */
export function calculatePlatformFee(amountCents: number, isPro: boolean): number {
  const feeRate = isPro ? PLATFORM_FEE_RATES.pro : PLATFORM_FEE_RATES.free;
  return Math.round(amountCents * feeRate);
}

/** Map due-date terms to days_until_due for Stripe. */
/** @internal Exported for testing only. */
export function getDaysUntilDue(terms: string, customDueDays?: number): number {
  switch (terms) {
    case "on_receipt":
      return 1; // Stripe requires ≥1 for send_invoice; 0 is invalid without a saved payment method
    case "net_15":
      return 15;
    case "net_30":
      return 30;
    case "net_60":
      return 60;
    case "custom":
      return customDueDays ?? 30;
    default:
      return 30;
  }
}

/** Wallet methods implied by `card` — not valid as standalone invoice payment_method_types. */
const WALLET_METHODS = new Set(["apple_pay", "google_pay"]);

/**
 * Convert frontend payment method names to valid Stripe invoice payment_method_types.
 * Filters out wallet methods (apple_pay, google_pay) which are automatically
 * enabled when `card` is present and cannot be set explicitly on invoices.
 */
/** @internal Exported for testing only. */
export function toStripePaymentMethodTypes(
  methods: string[],
): Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[] {
  return methods
    .filter((m) => !WALLET_METHODS.has(m))
    .map((m) => {
      if (m === "ach_debit") return "us_bank_account";
      return m;
    }) as Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[];
}

interface PaymentFieldConfig {
  _id: Id<"payment_field_configs">;
  fieldId: Id<"signature_fields">;
  documentId: Id<"documents">;
  organizationId: Id<"organizations">;
  paymentType: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    stripeProductId?: string;
    stripePriceId?: string;
  }>;
  currency: string;
  dueDateTerms: string;
  customDueDays?: number;
  totalAmountCents: number;
  feeHandling: string;
  allowedPaymentMethods: string[];
}

/**
 * Create Stripe invoice for a single one-time payment config.
 */
async function createOneTimeInvoice(
  ctx: ActionCtx,
  stripe: Stripe,
  config: PaymentFieldConfig,
  stripeAccountId: string,
  recipientEmail: string,
  recipientName: string | undefined,
  isPro: boolean,
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string | null }> {
  // Get or create customer on connected account
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const platformFeeCents = calculatePlatformFee(config.totalAmountCents, isPro);
  const applicationFeeAmount = platformFeeCents > 0 ? platformFeeCents : undefined;
  const daysUntilDue = getDaysUntilDue(config.dueDateTerms, config.customDueDays);

  const stripePaymentMethods = toStripePaymentMethodTypes(config.allowedPaymentMethods);

  // Always use send_invoice: new customers never have a saved payment method,
  // so charge_automatically would fail silently.
  const invoice = await stripe.invoices.create(
    {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      application_fee_amount: applicationFeeAmount,
      metadata: {
        documentId: config.documentId,
        organizationId: config.organizationId,
        paymentFieldConfigId: config._id,
        paymentFieldId: config.fieldId,
      },
      ...(stripePaymentMethods.length > 0 && {
        payment_settings: {
          payment_method_types: stripePaymentMethods,
        },
      }),
    },
    { stripeAccount: stripeAccountId },
  );

  try {
    // Create invoice items for each line item.
    // amount = total for the line (unitPrice × quantity, pre-computed).
    // quantity is passed for display on the hosted invoice ("2 × $50.00").
    for (const item of config.items) {
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          invoice: invoice.id,
          amount: item.unitPrice * item.quantity,
          currency: config.currency,
          description: item.description,
          quantity: item.quantity,
        },
        { stripeAccount: stripeAccountId },
      );
    }

    // Pass-through fee handling: add platform fee as visible line item
    if (config.feeHandling === "pass_to_recipient" && platformFeeCents > 0) {
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          invoice: invoice.id,
          amount: platformFeeCents,
          currency: config.currency,
          description: "Platform fee (Seal)",
        },
        { stripeAccount: stripeAccountId },
      );
    }

    // Finalize the invoice to generate hosted_invoice_url
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      invoice.id,
      { auto_advance: false },
      { stripeAccount: stripeAccountId },
    );

    // Store Stripe IDs back on the config
    await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
      configId: config._id,
      paymentStatus: "awaiting",
      stripeInvoiceId: finalizedInvoice.id,
    });

    return {
      stripeInvoiceId: finalizedInvoice.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url ?? null,
    };
  } catch (error) {
    // Clean up the orphaned draft invoice to avoid clutter on the connected account
    try {
      await stripe.invoices.del(invoice.id, { stripeAccount: stripeAccountId });
    } catch (deleteError) {
      console.warn("Failed to clean up orphaned draft invoice", {
        stripeInvoiceId: invoice.id,
        error: deleteError instanceof Error ? deleteError.message : String(deleteError),
      });
    }
    throw error;
  }
}

/**
 * Internal action: create Stripe objects for all payment fields on a document.
 *
 * Called during the send flow after validation passes.
 * Returns a map of recipientEmail → hostedInvoiceUrl for email inclusion.
 */
export const createStripeObjectsForPaymentFields = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all payment configs for this document
    const configs: Doc<"payment_field_configs">[] = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId },
    );

    if (configs.length === 0) {
      return { invoiceLinks: [] };
    }

    // Resolve connected account
    const account = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      { organizationId: args.organizationId },
    );

    if (!account) {
      throw new ConvexError("Stripe account not connected");
    }
    if (!account.chargesEnabled) {
      throw new ConvexError("Stripe account is not enabled for charges");
    }

    // Get subscription status for platform fee calculation
    const subscriptionStatus: { isPro: boolean; plan: "free" | "pro" } = await ctx.runQuery(
      internal.auth.subscription_helpers.checkProFeature,
      { userId: args.userId },
    );

    // Get recipients so we can look up email by field's recipientId
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );
    const recipientMap = new Map(recipients.map((r) => [r._id.toString(), r]));

    // Get signature fields to find which recipient each payment field is for
    const fields: Doc<"signature_fields">[] = await ctx.runQuery(
      internal.signature_fields.queries.getFieldsByDocumentInternal,
      { documentId: args.documentId },
    );
    const fieldMap = new Map(fields.map((f) => [f._id.toString(), f]));

    const stripe = initializeStripe();
    const invoiceLinks: Array<{
      recipientEmail: string;
      hostedInvoiceUrl: string | null;
      stripeInvoiceId: string;
      totalAmountCents: number;
      currency: string;
    }> = [];

    // Create Stripe objects for each config
    for (const config of configs) {
      // Validate: only one_time supported for now
      // (recurring/installments/deposit_balance will be added later)
      if (config.paymentType !== "one_time") {
        throw new ConvexError(
          `Payment type "${config.paymentType}" is not yet supported for automatic sending. Only one-time payments are currently supported.`,
        );
      }

      // Validate config has items
      if (config.items.length === 0) {
        throw new ConvexError("Payment field has no line items configured");
      }

      // Look up the field to get recipientId
      const field = fieldMap.get(config.fieldId.toString());
      if (!field) {
        throw new ConvexError("Payment field not found");
      }

      const recipient = recipientMap.get(field.recipientId.toString());
      if (!recipient) {
        throw new ConvexError("Recipient for payment field not found");
      }

      const result = await createOneTimeInvoice(
        ctx,
        stripe,
        config as PaymentFieldConfig,
        account.stripeAccountId,
        recipient.email,
        recipient.name,
        subscriptionStatus.isPro,
      );

      invoiceLinks.push({
        recipientEmail: recipient.email,
        hostedInvoiceUrl: result.hostedInvoiceUrl,
        stripeInvoiceId: result.stripeInvoiceId,
        totalAmountCents: config.totalAmountCents,
        currency: config.currency,
      });
    }

    return { invoiceLinks };
  },
});
