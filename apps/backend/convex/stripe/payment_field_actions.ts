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
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url ?? undefined,
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
 * Create two Stripe invoices for a deposit + balance payment config.
 * Invoice 1 (deposit): due immediately (days_until_due: 1)
 * Invoice 2 (balance): due after N days per config
 */
async function createDepositBalanceInvoices(
  ctx: ActionCtx,
  stripe: Stripe,
  config: PaymentFieldConfig,
  stripeAccountId: string,
  recipientEmail: string,
  recipientName: string | undefined,
  isPro: boolean,
  depositBalanceConfig: { depositPercent: number; balanceDueDays: number },
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string | null }> {
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const depositAmountCents = Math.round(
    config.totalAmountCents * (depositBalanceConfig.depositPercent / 100),
  );
  const balanceAmountCents = config.totalAmountCents - depositAmountCents;

  const platformFeeCents = calculatePlatformFee(config.totalAmountCents, isPro);
  // Split platform fee proportionally between the two invoices
  const depositFeeCents = Math.round(platformFeeCents * (depositAmountCents / config.totalAmountCents));
  const balanceFeeCents = platformFeeCents - depositFeeCents;

  const stripePaymentMethods = toStripePaymentMethodTypes(config.allowedPaymentMethods);
  const paymentSettings =
    stripePaymentMethods.length > 0 ? { payment_method_types: stripePaymentMethods } : undefined;

  const commonMetadata = {
    documentId: config.documentId,
    organizationId: config.organizationId,
    paymentFieldConfigId: config._id,
    paymentFieldId: config.fieldId,
  };

  // Create deposit invoice (due immediately)
  const depositInvoice = await stripe.invoices.create(
    {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 1,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      application_fee_amount: depositFeeCents > 0 ? depositFeeCents : undefined,
      metadata: { ...commonMetadata, invoiceType: "deposit" },
      ...(paymentSettings && { payment_settings: paymentSettings }),
    },
    { stripeAccount: stripeAccountId },
  );

  let balanceInvoice: Stripe.Invoice | undefined;

  try {
    // Add deposit line item
    await stripe.invoiceItems.create(
      {
        customer: customer.id,
        invoice: depositInvoice.id,
        amount: depositAmountCents,
        currency: config.currency,
        description: `Deposit (${depositBalanceConfig.depositPercent}%)`,
      },
      { stripeAccount: stripeAccountId },
    );

    // Pass-through fee on deposit
    if (config.feeHandling === "pass_to_recipient" && depositFeeCents > 0) {
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          invoice: depositInvoice.id,
          amount: depositFeeCents,
          currency: config.currency,
          description: "Platform fee (Seal)",
        },
        { stripeAccount: stripeAccountId },
      );
    }

    const finalizedDeposit = await stripe.invoices.finalizeInvoice(
      depositInvoice.id,
      { auto_advance: false },
      { stripeAccount: stripeAccountId },
    );

    // Create balance invoice
    balanceInvoice = await stripe.invoices.create(
      {
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: depositBalanceConfig.balanceDueDays,
        auto_advance: false,
        pending_invoice_items_behavior: "exclude",
        application_fee_amount: balanceFeeCents > 0 ? balanceFeeCents : undefined,
        metadata: { ...commonMetadata, invoiceType: "balance" },
        ...(paymentSettings && { payment_settings: paymentSettings }),
      },
      { stripeAccount: stripeAccountId },
    );

    // Add balance line items (original items minus deposit)
    for (const item of config.items) {
      const itemTotal = item.unitPrice * item.quantity;
      const itemBalancePortion = Math.round(
        itemTotal * (balanceAmountCents / config.totalAmountCents),
      );
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          invoice: balanceInvoice.id,
          amount: itemBalancePortion,
          currency: config.currency,
          description: `${item.description} (balance)`,
        },
        { stripeAccount: stripeAccountId },
      );
    }

    // Pass-through fee on balance
    if (config.feeHandling === "pass_to_recipient" && balanceFeeCents > 0) {
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          invoice: balanceInvoice.id,
          amount: balanceFeeCents,
          currency: config.currency,
          description: "Platform fee (Seal)",
        },
        { stripeAccount: stripeAccountId },
      );
    }

    await stripe.invoices.finalizeInvoice(
      balanceInvoice.id,
      { auto_advance: false },
      { stripeAccount: stripeAccountId },
    );

    // Store primary (deposit) invoice ID; balance invoice ID in metadata via stripePaymentIntentId field
    await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
      configId: config._id,
      paymentStatus: "awaiting",
      stripeInvoiceId: finalizedDeposit.id,
      stripePaymentIntentId: balanceInvoice.id, // Reusing this field for the second invoice ID
      hostedInvoiceUrl: finalizedDeposit.hosted_invoice_url ?? undefined,
    });

    return {
      stripeInvoiceId: finalizedDeposit.id,
      hostedInvoiceUrl: finalizedDeposit.hosted_invoice_url ?? null,
    };
  } catch (error) {
    // Clean up orphaned invoices
    const cleanupIds = [depositInvoice.id, balanceInvoice?.id].filter(Boolean) as string[];
    for (const invoiceId of cleanupIds) {
      try {
        await stripe.invoices.del(invoiceId, { stripeAccount: stripeAccountId });
      } catch (deleteError) {
        console.warn("Failed to clean up orphaned draft invoice", {
          stripeInvoiceId: invoiceId,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      }
    }
    throw error;
  }
}

/**
 * Create a Stripe Subscription (via Subscription Schedule when iterations are needed)
 * for a recurring payment config.
 *
 * Creates a Price on the connected account and starts the subscription.
 * Returns the first invoice's hosted URL for the recipient.
 */
async function createRecurringSubscription(
  ctx: ActionCtx,
  stripe: Stripe,
  config: PaymentFieldConfig,
  stripeAccountId: string,
  recipientEmail: string,
  recipientName: string | undefined,
  isPro: boolean,
  recurringConfig: {
    interval: "week" | "month" | "year";
    intervalCount: number;
    endCondition: "never" | "after_count" | "on_date";
    endAfterCount?: number;
    endOnDate?: number;
  },
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string | null }> {
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const stripePaymentMethods = toStripePaymentMethodTypes(config.allowedPaymentMethods);

  // Calculate platform fee as a percentage for subscriptions
  const platformFeePercent = isPro ? 0.25 : 1;

  // Create a recurring price on the connected account
  const price = await stripe.prices.create(
    {
      unit_amount: config.totalAmountCents,
      currency: config.currency,
      recurring: {
        interval: recurringConfig.interval,
        interval_count: recurringConfig.intervalCount,
      },
      product_data: {
        name: config.items.map((i) => i.description).join(", "),
        metadata: {
          documentId: config.documentId,
          paymentFieldConfigId: config._id,
        },
      },
    },
    { stripeAccount: stripeAccountId },
  );

  const commonMetadata = {
    documentId: config.documentId,
    organizationId: config.organizationId,
    paymentFieldConfigId: config._id,
    paymentFieldId: config.fieldId,
  };

  let subscriptionId: string;
  let firstInvoiceId: string | undefined;
  let hostedInvoiceUrl: string | null = null;

  if (
    recurringConfig.endCondition === "after_count" &&
    recurringConfig.endAfterCount !== undefined
  ) {
    // Use Subscription Schedule for fixed iteration count
    // duration = total billing periods (iterations × interval_count)
    const totalIntervals = recurringConfig.endAfterCount * recurringConfig.intervalCount;
    const schedule = await stripe.subscriptionSchedules.create(
      {
        customer: customer.id,
        start_date: "now",
        end_behavior: "cancel",
        phases: [
          {
            items: [{ price: price.id }],
            duration: {
              interval: recurringConfig.interval,
              interval_count: totalIntervals,
            },
            application_fee_percent: platformFeePercent,
            collection_method: "send_invoice",
            invoice_settings: {
              days_until_due: getDaysUntilDue(config.dueDateTerms, config.customDueDays),
            },
            metadata: commonMetadata,
          },
        ],
        metadata: commonMetadata,
      },
      { stripeAccount: stripeAccountId },
    );

    subscriptionId = schedule.subscription as string;
  } else if (
    recurringConfig.endCondition === "on_date" &&
    recurringConfig.endOnDate !== undefined
  ) {
    // Create subscription with cancel_at for date-based end
    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price: price.id }],
        collection_method: "send_invoice",
        days_until_due: getDaysUntilDue(config.dueDateTerms, config.customDueDays),
        application_fee_percent: platformFeePercent,
        cancel_at: Math.floor(recurringConfig.endOnDate / 1000), // Convert ms to seconds
        metadata: commonMetadata,
        ...(stripePaymentMethods.length > 0 && {
          payment_settings: {
            payment_method_types:
              stripePaymentMethods as Stripe.SubscriptionCreateParams.PaymentSettings.PaymentMethodType[],
          },
        }),
      },
      { stripeAccount: stripeAccountId },
    );

    subscriptionId = subscription.id;
  } else {
    // Open-ended recurring: no end condition
    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price: price.id }],
        collection_method: "send_invoice",
        days_until_due: getDaysUntilDue(config.dueDateTerms, config.customDueDays),
        application_fee_percent: platformFeePercent,
        metadata: commonMetadata,
        ...(stripePaymentMethods.length > 0 && {
          payment_settings: {
            payment_method_types:
              stripePaymentMethods as Stripe.SubscriptionCreateParams.PaymentSettings.PaymentMethodType[],
          },
        }),
      },
      { stripeAccount: stripeAccountId },
    );

    subscriptionId = subscription.id;
  }

  // Retrieve the subscription to get the latest invoice
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    stripeAccount: stripeAccountId,
  });

  firstInvoiceId = subscription.latest_invoice as string | undefined;

  if (firstInvoiceId) {
    // Finalize the first invoice to generate hosted URL
    try {
      const invoice = await stripe.invoices.retrieve(firstInvoiceId, {
        stripeAccount: stripeAccountId,
      });

      if (invoice.status === "draft") {
        const finalized = await stripe.invoices.finalizeInvoice(
          firstInvoiceId,
          { auto_advance: false },
          { stripeAccount: stripeAccountId },
        );
        hostedInvoiceUrl = finalized.hosted_invoice_url ?? null;
      } else {
        hostedInvoiceUrl = invoice.hosted_invoice_url ?? null;
      }
    } catch (invoiceError) {
      console.warn("Failed to finalize first subscription invoice", {
        subscriptionId,
        invoiceId: firstInvoiceId,
        error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
      });
    }
  }

  await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
    configId: config._id,
    paymentStatus: "awaiting",
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: firstInvoiceId,
    hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
  });

  return {
    stripeInvoiceId: firstInvoiceId ?? subscriptionId,
    hostedInvoiceUrl,
  };
}

/**
 * Create installment payments using a Subscription Schedule with fixed iterations.
 * Each installment is an equal portion of the total (or custom first payment if specified).
 */
async function createInstallmentSubscription(
  ctx: ActionCtx,
  stripe: Stripe,
  config: PaymentFieldConfig,
  stripeAccountId: string,
  recipientEmail: string,
  recipientName: string | undefined,
  isPro: boolean,
  installmentsConfig: {
    count: number;
    interval: "week" | "month";
    firstPaymentAmount?: number;
  },
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string | null }> {
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const stripePaymentMethods = toStripePaymentMethodTypes(config.allowedPaymentMethods);
  const platformFeePercent = isPro ? 0.25 : 1;
  const daysUntilDue = getDaysUntilDue(config.dueDateTerms, config.customDueDays);

  const commonMetadata = {
    documentId: config.documentId,
    organizationId: config.organizationId,
    paymentFieldConfigId: config._id,
    paymentFieldId: config.fieldId,
  };

  const hasCustomFirstPayment =
    installmentsConfig.firstPaymentAmount !== undefined &&
    installmentsConfig.firstPaymentAmount > 0;

  if (hasCustomFirstPayment) {
    // Different first payment: create one-time invoice for first payment,
    // then subscription for remaining installments
    const firstAmount = installmentsConfig.firstPaymentAmount!;
    const remainingTotal = config.totalAmountCents - firstAmount;
    const remainingCount = installmentsConfig.count - 1;
    const installmentAmount = Math.round(remainingTotal / remainingCount);

    // Create first payment as one-time invoice
    const firstInvoice = await createOneTimeInvoiceForAmount(
      stripe,
      customer.id,
      stripeAccountId,
      firstAmount,
      config.currency,
      `Installment 1 of ${installmentsConfig.count}`,
      daysUntilDue,
      calculatePlatformFee(firstAmount, isPro),
      config.feeHandling,
      stripePaymentMethods,
      commonMetadata,
    );

    // Create subscription for remaining installments
    const price = await stripe.prices.create(
      {
        unit_amount: installmentAmount,
        currency: config.currency,
        recurring: {
          interval: installmentsConfig.interval,
          interval_count: 1,
        },
        product_data: {
          name: `Installments (${remainingCount} remaining) - ${config.items.map((i) => i.description).join(", ")}`,
          metadata: { documentId: config.documentId, paymentFieldConfigId: config._id },
        },
      },
      { stripeAccount: stripeAccountId },
    );

    const schedule = await stripe.subscriptionSchedules.create(
      {
        customer: customer.id,
        start_date: "now",
        end_behavior: "cancel",
        phases: [
          {
            items: [{ price: price.id }],
            duration: {
              interval: installmentsConfig.interval,
              interval_count: remainingCount,
            },
            application_fee_percent: platformFeePercent,
            collection_method: "send_invoice",
            invoice_settings: { days_until_due: daysUntilDue },
            metadata: commonMetadata,
          },
        ],
        metadata: commonMetadata,
      },
      { stripeAccount: stripeAccountId },
    );

    const subscriptionId = schedule.subscription as string;

    await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
      configId: config._id,
      paymentStatus: "awaiting",
      stripeInvoiceId: firstInvoice.id,
      stripeSubscriptionId: subscriptionId,
      hostedInvoiceUrl: firstInvoice.hosted_invoice_url ?? undefined,
    });

    return {
      stripeInvoiceId: firstInvoice.id,
      hostedInvoiceUrl: firstInvoice.hosted_invoice_url ?? null,
    };
  }

  // Equal installments: use subscription schedule with iterations
  const installmentAmount = Math.round(config.totalAmountCents / installmentsConfig.count);

  const price = await stripe.prices.create(
    {
      unit_amount: installmentAmount,
      currency: config.currency,
      recurring: {
        interval: installmentsConfig.interval,
        interval_count: 1,
      },
      product_data: {
        name: `Installments (${installmentsConfig.count}x) - ${config.items.map((i) => i.description).join(", ")}`,
        metadata: { documentId: config.documentId, paymentFieldConfigId: config._id },
      },
    },
    { stripeAccount: stripeAccountId },
  );

  const schedule = await stripe.subscriptionSchedules.create(
    {
      customer: customer.id,
      start_date: "now",
      end_behavior: "cancel",
      phases: [
        {
          items: [{ price: price.id }],
          duration: {
            interval: installmentsConfig.interval,
            interval_count: installmentsConfig.count,
          },
          application_fee_percent: platformFeePercent,
          collection_method: "send_invoice",
          invoice_settings: { days_until_due: daysUntilDue },
          metadata: commonMetadata,
        },
      ],
      metadata: commonMetadata,
    },
    { stripeAccount: stripeAccountId },
  );

  const subscriptionId = schedule.subscription as string;

  // Get first invoice from subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    stripeAccount: stripeAccountId,
  });

  const firstInvoiceId = subscription.latest_invoice as string | undefined;
  let hostedInvoiceUrl: string | null = null;

  if (firstInvoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(firstInvoiceId, {
        stripeAccount: stripeAccountId,
      });
      if (invoice.status === "draft") {
        const finalized = await stripe.invoices.finalizeInvoice(
          firstInvoiceId,
          { auto_advance: false },
          { stripeAccount: stripeAccountId },
        );
        hostedInvoiceUrl = finalized.hosted_invoice_url ?? null;
      } else {
        hostedInvoiceUrl = invoice.hosted_invoice_url ?? null;
      }
    } catch (invoiceError) {
      console.warn("Failed to finalize first installment invoice", {
        subscriptionId,
        invoiceId: firstInvoiceId,
        error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
      });
    }
  }

  await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
    configId: config._id,
    paymentStatus: "awaiting",
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: firstInvoiceId,
    hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
  });

  return {
    stripeInvoiceId: firstInvoiceId ?? subscriptionId,
    hostedInvoiceUrl,
  };
}

/**
 * Helper: create a one-time invoice for a specific amount (used by installments with custom first payment).
 */
async function createOneTimeInvoiceForAmount(
  stripe: Stripe,
  customerId: string,
  stripeAccountId: string,
  amountCents: number,
  currency: string,
  description: string,
  daysUntilDue: number,
  platformFeeCents: number,
  feeHandling: string,
  stripePaymentMethods: Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[],
  metadata: Record<string, string>,
): Promise<Stripe.Invoice> {
  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      application_fee_amount: platformFeeCents > 0 ? platformFeeCents : undefined,
      metadata,
      ...(stripePaymentMethods.length > 0 && {
        payment_settings: { payment_method_types: stripePaymentMethods },
      }),
    },
    { stripeAccount: stripeAccountId },
  );

  await stripe.invoiceItems.create(
    {
      customer: customerId,
      invoice: invoice.id,
      amount: amountCents,
      currency,
      description,
    },
    { stripeAccount: stripeAccountId },
  );

  if (feeHandling === "pass_to_recipient" && platformFeeCents > 0) {
    await stripe.invoiceItems.create(
      {
        customer: customerId,
        invoice: invoice.id,
        amount: platformFeeCents,
        currency,
        description: "Platform fee (Seal)",
      },
      { stripeAccount: stripeAccountId },
    );
  }

  return stripe.invoices.finalizeInvoice(
    invoice.id,
    { auto_advance: false },
    { stripeAccount: stripeAccountId },
  );
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
      // Validate config has items
      if (config.items.length === 0) {
        throw new ConvexError("Payment field has no line items configured");
      }

      // Look up the field to get recipientId
      const field = fieldMap.get(config.fieldId.toString());
      if (!field) {
        throw new ConvexError("Payment field not found");
      }

      if (!field.recipientId) {
        throw new ConvexError("Payment field must be assigned to a recipient before processing");
      }
      const recipient = recipientMap.get(field.recipientId.toString());
      if (!recipient) {
        throw new ConvexError("Recipient for payment field not found");
      }

      const typedConfig = config as PaymentFieldConfig;
      let result: { stripeInvoiceId: string; hostedInvoiceUrl: string | null };

      switch (config.paymentType) {
        case "one_time":
          result = await createOneTimeInvoice(
            ctx,
            stripe,
            typedConfig,
            account.stripeAccountId,
            recipient.email,
            recipient.name,
            subscriptionStatus.isPro,
          );
          break;

        case "deposit_balance": {
          if (!config.depositBalanceConfig) {
            throw new ConvexError("Deposit/balance config is missing for deposit_balance payment");
          }
          result = await createDepositBalanceInvoices(
            ctx,
            stripe,
            typedConfig,
            account.stripeAccountId,
            recipient.email,
            recipient.name,
            subscriptionStatus.isPro,
            config.depositBalanceConfig,
          );
          break;
        }

        case "recurring": {
          if (!config.recurringConfig) {
            throw new ConvexError("Recurring config is missing for recurring payment");
          }
          result = await createRecurringSubscription(
            ctx,
            stripe,
            typedConfig,
            account.stripeAccountId,
            recipient.email,
            recipient.name,
            subscriptionStatus.isPro,
            config.recurringConfig,
          );
          break;
        }

        case "installments": {
          if (!config.installmentsConfig) {
            throw new ConvexError("Installments config is missing for installment payment");
          }
          result = await createInstallmentSubscription(
            ctx,
            stripe,
            typedConfig,
            account.stripeAccountId,
            recipient.email,
            recipient.name,
            subscriptionStatus.isPro,
            config.installmentsConfig,
          );
          break;
        }

        default: {
          const _exhaustive: never = config.paymentType;
          throw new ConvexError(
            `Unsupported payment type: "${String(_exhaustive)}"`,
          );
        }
      }

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
