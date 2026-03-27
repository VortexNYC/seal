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
import { action, internalAction } from "../_generated/server";
import { getOrCreateConnectedCustomer } from "./connect_helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

/**
 * Platform fee calculation using tier-aware rates from subscription_guards.
 * Card: 4.5%+30¢ (Free), 4%+30¢ (Pro), custom (Enterprise)
 * ACH: $0 (Stripe passthrough at cost)
 */
import { calculateApplicationFee, type TierPlan } from "../auth/subscription_guards";

/** @internal Exported for testing only. */
export function calculatePlatformFee(amountCents: number, isPro: boolean): number {
  const plan: TierPlan = isPro ? "pro" : "free";
  return calculateApplicationFee(amountCents, plan, false);
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

type PaymentInvoiceResult = {
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
};

type PaymentRecipient = {
  email: string;
  name: string | undefined;
};

function buildPaymentMetadata(
  config: PaymentFieldConfig,
  extraMetadata?: Record<string, string>,
): Record<string, string> {
  return {
    documentId: config.documentId,
    organizationId: config.organizationId,
    paymentFieldConfigId: config._id,
    paymentFieldId: config.fieldId,
    ...extraMetadata,
  };
}

function getInvoicePaymentSettings(allowedPaymentMethods: string[]):
  | {
      payment_method_types: Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[];
    }
  | undefined {
  const stripePaymentMethods = toStripePaymentMethodTypes(allowedPaymentMethods);
  return stripePaymentMethods.length > 0
    ? { payment_method_types: stripePaymentMethods }
    : undefined;
}

function buildProductName(items: PaymentFieldConfig["items"], prefix?: string): string {
  const itemNames = items.map((item) => item.description).join(", ");
  return prefix ? `${prefix} - ${itemNames}` : itemNames;
}

async function createDraftSendInvoice(
  stripe: Stripe,
  stripeAccountId: string,
  params: {
    customerId: string;
    daysUntilDue: number;
    applicationFeeAmount?: number;
    metadata: Record<string, string>;
    paymentSettings?: {
      payment_method_types: Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[];
    };
  },
): Promise<Stripe.Invoice> {
  return await stripe.invoices.create(
    {
      customer: params.customerId,
      collection_method: "send_invoice",
      days_until_due: params.daysUntilDue,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      application_fee_amount: params.applicationFeeAmount,
      metadata: params.metadata,
      ...(params.paymentSettings && { payment_settings: params.paymentSettings }),
    },
    { stripeAccount: stripeAccountId },
  );
}

async function addInvoiceLineItem(
  stripe: Stripe,
  stripeAccountId: string,
  params: {
    customerId: string;
    invoiceId: string;
    amount: number;
    currency: string;
    description: string;
  },
): Promise<void> {
  await stripe.invoiceItems.create(
    {
      customer: params.customerId,
      invoice: params.invoiceId,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
    },
    { stripeAccount: stripeAccountId },
  );
}

async function maybeAddPlatformFeeLineItem(
  stripe: Stripe,
  stripeAccountId: string,
  params: {
    customerId: string;
    invoiceId: string;
    currency: string;
    feeHandling: string;
    platformFeeCents: number;
  },
): Promise<void> {
  if (params.feeHandling !== "pass_to_recipient" || params.platformFeeCents <= 0) {
    return;
  }

  await addInvoiceLineItem(stripe, stripeAccountId, {
    customerId: params.customerId,
    invoiceId: params.invoiceId,
    amount: params.platformFeeCents,
    currency: params.currency,
    description: "Platform fee (Seal)",
  });
}

async function finalizeDraftInvoice(
  stripe: Stripe,
  stripeAccountId: string,
  invoiceId: string,
): Promise<Stripe.Invoice> {
  return await stripe.invoices.finalizeInvoice(
    invoiceId,
    { auto_advance: false },
    { stripeAccount: stripeAccountId },
  );
}

async function cleanupDraftInvoices(
  stripe: Stripe,
  stripeAccountId: string,
  invoiceIds: Array<string | undefined>,
): Promise<void> {
  for (const invoiceId of invoiceIds) {
    if (!invoiceId) {
      continue;
    }

    try {
      await stripe.invoices.del(invoiceId, { stripeAccount: stripeAccountId });
    } catch (deleteError) {
      console.warn("Failed to clean up orphaned draft invoice", {
        stripeInvoiceId: invoiceId,
        error: deleteError instanceof Error ? deleteError.message : String(deleteError),
      });
    }
  }
}

async function createSubscriptionPrice(
  stripe: Stripe,
  stripeAccountId: string,
  config: PaymentFieldConfig,
  recurring: { interval: "week" | "month" | "year"; intervalCount: number },
  unitAmount: number,
  productName: string,
): Promise<Stripe.Price> {
  return await stripe.prices.create(
    {
      unit_amount: unitAmount,
      currency: config.currency,
      recurring: {
        interval: recurring.interval,
        interval_count: recurring.intervalCount,
      },
      product_data: {
        name: productName,
        metadata: {
          documentId: config.documentId,
          paymentFieldConfigId: config._id,
        },
      },
    },
    { stripeAccount: stripeAccountId },
  );
}

async function createRecurringPrice(
  stripe: Stripe,
  stripeAccountId: string,
  config: PaymentFieldConfig,
  recurring: { interval: "week" | "month" | "year"; intervalCount: number },
  productName: string,
): Promise<Stripe.Price> {
  return await createSubscriptionPrice(
    stripe,
    stripeAccountId,
    config,
    recurring,
    config.totalAmountCents,
    productName,
  );
}

async function finalizeLatestInvoiceForSubscription(
  stripe: Stripe,
  stripeAccountId: string,
  subscriptionId: string,
): Promise<{ firstInvoiceId: string | undefined; hostedInvoiceUrl: string | null }> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    stripeAccount: stripeAccountId,
  });
  const firstInvoiceId = subscription.latest_invoice as string | undefined;

  if (!firstInvoiceId) {
    return { firstInvoiceId, hostedInvoiceUrl: null };
  }

  try {
    const invoice = await stripe.invoices.retrieve(firstInvoiceId, {
      stripeAccount: stripeAccountId,
    });

    if (invoice.status !== "draft") {
      return {
        firstInvoiceId,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      };
    }

    const finalizedInvoice = await finalizeDraftInvoice(stripe, stripeAccountId, firstInvoiceId);
    return {
      firstInvoiceId,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url ?? null,
    };
  } catch (invoiceError) {
    console.warn("Failed to finalize first subscription invoice", {
      subscriptionId,
      invoiceId: firstInvoiceId,
      error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
    });
    return { firstInvoiceId, hostedInvoiceUrl: null };
  }
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
): Promise<PaymentInvoiceResult> {
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const platformFeeCents = calculatePlatformFee(config.totalAmountCents, isPro);
  const invoice = await createDraftSendInvoice(stripe, stripeAccountId, {
    customerId: customer.id,
    daysUntilDue: getDaysUntilDue(config.dueDateTerms, config.customDueDays),
    applicationFeeAmount: platformFeeCents > 0 ? platformFeeCents : undefined,
    metadata: buildPaymentMetadata(config),
    paymentSettings: getInvoicePaymentSettings(config.allowedPaymentMethods),
  });

  try {
    for (const item of config.items) {
      await addInvoiceLineItem(stripe, stripeAccountId, {
        customerId: customer.id,
        invoiceId: invoice.id,
        amount: item.unitPrice * item.quantity,
        currency: config.currency,
        description:
          item.quantity > 1 ? `${item.description} (×${item.quantity})` : item.description,
      });
    }

    await maybeAddPlatformFeeLineItem(stripe, stripeAccountId, {
      customerId: customer.id,
      invoiceId: invoice.id,
      currency: config.currency,
      feeHandling: config.feeHandling,
      platformFeeCents,
    });

    const finalizedInvoice = await finalizeDraftInvoice(stripe, stripeAccountId, invoice.id);
    await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
      configId: config._id,
      paymentStatus: "awaiting",
      stripeInvoiceId: finalizedInvoice.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url ?? undefined,
      stripeAccountId,
      customerEmail: recipientEmail,
      customerName: recipientName,
    });

    return {
      stripeInvoiceId: finalizedInvoice.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url ?? null,
    };
  } catch (error) {
    await cleanupDraftInvoices(stripe, stripeAccountId, [invoice.id]);
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
): Promise<PaymentInvoiceResult> {
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
  const depositFeeCents = Math.round(
    platformFeeCents * (depositAmountCents / config.totalAmountCents),
  );
  const balanceFeeCents = platformFeeCents - depositFeeCents;
  const paymentSettings = getInvoicePaymentSettings(config.allowedPaymentMethods);
  const depositInvoice = await createDraftSendInvoice(stripe, stripeAccountId, {
    customerId: customer.id,
    daysUntilDue: 1,
    applicationFeeAmount: depositFeeCents > 0 ? depositFeeCents : undefined,
    metadata: buildPaymentMetadata(config, { invoiceType: "deposit" }),
    paymentSettings,
  });

  let balanceInvoice: Stripe.Invoice | undefined;

  try {
    await addInvoiceLineItem(stripe, stripeAccountId, {
      customerId: customer.id,
      invoiceId: depositInvoice.id,
      amount: depositAmountCents,
      currency: config.currency,
      description: `Deposit (${depositBalanceConfig.depositPercent}%)`,
    });
    await maybeAddPlatformFeeLineItem(stripe, stripeAccountId, {
      customerId: customer.id,
      invoiceId: depositInvoice.id,
      currency: config.currency,
      feeHandling: config.feeHandling,
      platformFeeCents: depositFeeCents,
    });

    const finalizedDeposit = await finalizeDraftInvoice(stripe, stripeAccountId, depositInvoice.id);
    balanceInvoice = await createDraftSendInvoice(stripe, stripeAccountId, {
      customerId: customer.id,
      daysUntilDue: depositBalanceConfig.balanceDueDays,
      applicationFeeAmount: balanceFeeCents > 0 ? balanceFeeCents : undefined,
      metadata: buildPaymentMetadata(config, { invoiceType: "balance" }),
      paymentSettings,
    });

    for (const item of config.items) {
      const itemTotal = item.unitPrice * item.quantity;
      await addInvoiceLineItem(stripe, stripeAccountId, {
        customerId: customer.id,
        invoiceId: balanceInvoice.id,
        amount: Math.round(itemTotal * (balanceAmountCents / config.totalAmountCents)),
        currency: config.currency,
        description: `${item.description} (balance)`,
      });
    }

    await maybeAddPlatformFeeLineItem(stripe, stripeAccountId, {
      customerId: customer.id,
      invoiceId: balanceInvoice.id,
      currency: config.currency,
      feeHandling: config.feeHandling,
      platformFeeCents: balanceFeeCents,
    });
    await finalizeDraftInvoice(stripe, stripeAccountId, balanceInvoice.id);

    await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
      configId: config._id,
      paymentStatus: "awaiting",
      stripeInvoiceId: finalizedDeposit.id,
      stripePaymentIntentId: balanceInvoice.id,
      hostedInvoiceUrl: finalizedDeposit.hosted_invoice_url ?? undefined,
      stripeAccountId,
      customerEmail: recipientEmail,
      customerName: recipientName,
    });

    return {
      stripeInvoiceId: finalizedDeposit.id,
      hostedInvoiceUrl: finalizedDeposit.hosted_invoice_url ?? null,
    };
  } catch (error) {
    await cleanupDraftInvoices(stripe, stripeAccountId, [depositInvoice.id, balanceInvoice?.id]);
    throw error;
  }
}

async function createScheduledSubscription(
  stripe: Stripe,
  stripeAccountId: string,
  params: {
    customerId: string;
    priceId: string;
    interval: "week" | "month" | "year";
    intervalCount: number;
    applicationFeePercent: number;
    daysUntilDue: number;
    metadata: Record<string, string>;
  },
): Promise<string> {
  const schedule = await stripe.subscriptionSchedules.create(
    {
      customer: params.customerId,
      start_date: "now",
      end_behavior: "cancel",
      phases: [
        {
          items: [{ price: params.priceId }],
          duration: {
            interval: params.interval,
            interval_count: params.intervalCount,
          },
          application_fee_percent: params.applicationFeePercent,
          collection_method: "send_invoice",
          invoice_settings: { days_until_due: params.daysUntilDue },
          metadata: params.metadata,
        },
      ],
      metadata: params.metadata,
    },
    { stripeAccount: stripeAccountId },
  );

  return schedule.subscription as string;
}

async function createSendInvoiceSubscription(
  stripe: Stripe,
  stripeAccountId: string,
  params: {
    customerId: string;
    priceId: string;
    daysUntilDue: number;
    applicationFeePercent: number;
    metadata: Record<string, string>;
    cancelAt?: number;
    paymentMethods: Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[];
  },
): Promise<string> {
  const subscription = await stripe.subscriptions.create(
    {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      collection_method: "send_invoice",
      days_until_due: params.daysUntilDue,
      application_fee_percent: params.applicationFeePercent,
      ...(params.cancelAt && { cancel_at: params.cancelAt }),
      metadata: params.metadata,
      ...(params.paymentMethods.length > 0 && {
        payment_settings: {
          payment_method_types:
            params.paymentMethods as Stripe.SubscriptionCreateParams.PaymentSettings.PaymentMethodType[],
        },
      }),
    },
    { stripeAccount: stripeAccountId },
  );

  return subscription.id;
}

async function storeSubscriptionIds(
  ctx: ActionCtx,
  configId: Id<"payment_field_configs">,
  subscriptionId: string,
  firstInvoiceId: string | undefined,
  hostedInvoiceUrl: string | null,
  invoiceTracking?: { stripeAccountId: string; customerEmail: string; customerName?: string },
): Promise<PaymentInvoiceResult> {
  await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
    configId,
    paymentStatus: "awaiting",
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: firstInvoiceId,
    hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
    stripeAccountId: invoiceTracking?.stripeAccountId,
    customerEmail: invoiceTracking?.customerEmail,
    customerName: invoiceTracking?.customerName,
  });

  return {
    stripeInvoiceId: firstInvoiceId ?? subscriptionId,
    hostedInvoiceUrl,
  };
}

async function createInstallmentSchedule(
  stripe: Stripe,
  stripeAccountId: string,
  params: {
    customerId: string;
    config: PaymentFieldConfig;
    unitAmount: number;
    interval: "week" | "month";
    intervalCount: number;
    applicationFeePercent: number;
    daysUntilDue: number;
    metadata: Record<string, string>;
    productName: string;
  },
): Promise<string> {
  const price = await createSubscriptionPrice(
    stripe,
    stripeAccountId,
    params.config,
    {
      interval: params.interval,
      intervalCount: 1,
    },
    params.unitAmount,
    params.productName,
  );

  return await createScheduledSubscription(stripe, stripeAccountId, {
    customerId: params.customerId,
    priceId: price.id,
    interval: params.interval,
    intervalCount: params.intervalCount,
    applicationFeePercent: params.applicationFeePercent,
    daysUntilDue: params.daysUntilDue,
    metadata: params.metadata,
  });
}

async function createCustomFirstInstallment(
  ctx: ActionCtx,
  stripe: Stripe,
  stripeAccountId: string,
  config: PaymentFieldConfig,
  customerId: string,
  isPro: boolean,
  installmentsConfig: {
    count: number;
    interval: "week" | "month";
    firstPaymentAmount?: number;
  },
  daysUntilDue: number,
  metadata: Record<string, string>,
  platformFeePercent: number,
  stripePaymentMethods: Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[],
  customerEmail: string,
  customerName?: string,
): Promise<PaymentInvoiceResult> {
  const firstAmount = installmentsConfig.firstPaymentAmount!;
  const remainingCount = installmentsConfig.count - 1;
  const installmentAmount = Math.round((config.totalAmountCents - firstAmount) / remainingCount);
  const firstInvoice = await createOneTimeInvoiceForAmount(
    stripe,
    customerId,
    stripeAccountId,
    firstAmount,
    config.currency,
    `Installment 1 of ${installmentsConfig.count}`,
    daysUntilDue,
    calculatePlatformFee(firstAmount, isPro),
    config.feeHandling,
    stripePaymentMethods,
    metadata,
  );
  const subscriptionId = await createInstallmentSchedule(stripe, stripeAccountId, {
    customerId,
    config,
    unitAmount: installmentAmount,
    interval: installmentsConfig.interval,
    intervalCount: remainingCount,
    applicationFeePercent: platformFeePercent,
    daysUntilDue,
    metadata,
    productName: buildProductName(config.items, `Installments (${remainingCount} remaining)`),
  });

  await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
    configId: config._id,
    paymentStatus: "awaiting",
    stripeInvoiceId: firstInvoice.id,
    stripeSubscriptionId: subscriptionId,
    hostedInvoiceUrl: firstInvoice.hosted_invoice_url ?? undefined,
    stripeAccountId,
    customerEmail,
    customerName,
  });

  return {
    stripeInvoiceId: firstInvoice.id,
    hostedInvoiceUrl: firstInvoice.hosted_invoice_url ?? null,
  };
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
): Promise<PaymentInvoiceResult> {
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const stripePaymentMethods = toStripePaymentMethodTypes(config.allowedPaymentMethods);
<<<<<<< HEAD
  const platformFeePercent = isPro ? 0.25 : 1;
=======
  // Card rates: 4.5% (Free), 4% (Pro). Note: 30¢ fixed component not expressible via application_fee_percent.
  const platformFeePercent = isPro ? 4 : 4.5;
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
  const commonMetadata = buildPaymentMetadata(config);
  const daysUntilDue = getDaysUntilDue(config.dueDateTerms, config.customDueDays);
  const price = await createRecurringPrice(
    stripe,
    stripeAccountId,
    config,
    {
      interval: recurringConfig.interval,
      intervalCount: recurringConfig.intervalCount,
    },
    buildProductName(config.items),
  );

  if (
    recurringConfig.endCondition === "after_count" &&
    recurringConfig.endAfterCount !== undefined
  ) {
    const subscriptionId = await createScheduledSubscription(stripe, stripeAccountId, {
      customerId: customer.id,
      priceId: price.id,
      interval: recurringConfig.interval,
      intervalCount: recurringConfig.endAfterCount * recurringConfig.intervalCount,
      applicationFeePercent: platformFeePercent,
      daysUntilDue,
      metadata: commonMetadata,
    });
    const invoiceDetails = await finalizeLatestInvoiceForSubscription(
      stripe,
      stripeAccountId,
      subscriptionId,
    );
    return await storeSubscriptionIds(
      ctx,
      config._id,
      subscriptionId,
      invoiceDetails.firstInvoiceId,
      invoiceDetails.hostedInvoiceUrl,
      { stripeAccountId, customerEmail: recipientEmail, customerName: recipientName },
    );
  }

  const subscriptionId = await createSendInvoiceSubscription(stripe, stripeAccountId, {
    customerId: customer.id,
    priceId: price.id,
    daysUntilDue,
    applicationFeePercent: platformFeePercent,
    metadata: commonMetadata,
    cancelAt: recurringConfig.endOnDate ? Math.floor(recurringConfig.endOnDate / 1000) : undefined,
    paymentMethods: stripePaymentMethods,
  });
  const invoiceDetails = await finalizeLatestInvoiceForSubscription(
    stripe,
    stripeAccountId,
    subscriptionId,
  );
  return await storeSubscriptionIds(
    ctx,
    config._id,
    subscriptionId,
    invoiceDetails.firstInvoiceId,
    invoiceDetails.hostedInvoiceUrl,
    { stripeAccountId, customerEmail: recipientEmail, customerName: recipientName },
  );
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
): Promise<PaymentInvoiceResult> {
  const customer = await getOrCreateConnectedCustomer(
    stripe,
    stripeAccountId,
    recipientEmail,
    recipientName,
  );

  const stripePaymentMethods = toStripePaymentMethodTypes(config.allowedPaymentMethods);
  // Card rates: 4.5% (Free), 4% (Pro). Note: 30¢ fixed component not expressible via application_fee_percent.
  const platformFeePercent = isPro ? 4 : 4.5;
  const daysUntilDue = getDaysUntilDue(config.dueDateTerms, config.customDueDays);
  const commonMetadata = buildPaymentMetadata(config);

  if (installmentsConfig.firstPaymentAmount && installmentsConfig.firstPaymentAmount > 0) {
    return await createCustomFirstInstallment(
      ctx,
      stripe,
      stripeAccountId,
      config,
      customer.id,
      isPro,
      installmentsConfig,
      daysUntilDue,
      commonMetadata,
      platformFeePercent,
      stripePaymentMethods,
      recipientEmail,
      recipientName,
    );
  }

  const installmentAmount = Math.round(config.totalAmountCents / installmentsConfig.count);
  const subscriptionId = await createInstallmentSchedule(stripe, stripeAccountId, {
    customerId: customer.id,
    config,
    unitAmount: installmentAmount,
    interval: installmentsConfig.interval,
    intervalCount: installmentsConfig.count,
    applicationFeePercent: platformFeePercent,
    daysUntilDue,
    metadata: commonMetadata,
    productName: buildProductName(config.items, `Installments (${installmentsConfig.count}x)`),
  });
  const invoiceDetails = await finalizeLatestInvoiceForSubscription(
    stripe,
    stripeAccountId,
    subscriptionId,
  );

  return await storeSubscriptionIds(
    ctx,
    config._id,
    subscriptionId,
    invoiceDetails.firstInvoiceId,
    invoiceDetails.hostedInvoiceUrl,
    { stripeAccountId, customerEmail: recipientEmail, customerName: recipientName },
  );
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

type PaymentFieldProcessingContext = {
  stripeAccountId: string;
  isPro: boolean;
  recipient: PaymentRecipient;
};

function resolvePaymentFieldRecipient(
  config: Doc<"payment_field_configs">,
  fieldMap: Map<string, Doc<"signature_fields">>,
  recipientMap: Map<string, Doc<"document_recipients">>,
): PaymentRecipient {
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }

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

  return {
    email: recipient.email,
    name: recipient.name ?? undefined,
  };
}

async function createStripeObjectsForConfig(
  ctx: ActionCtx,
  stripe: Stripe,
  config: Doc<"payment_field_configs">,
  processingContext: PaymentFieldProcessingContext,
): Promise<PaymentInvoiceResult> {
  const typedConfig = config as PaymentFieldConfig;

  switch (config.paymentType) {
    case "one_time":
      return await createOneTimeInvoice(
        ctx,
        stripe,
        typedConfig,
        processingContext.stripeAccountId,
        processingContext.recipient.email,
        processingContext.recipient.name,
        processingContext.isPro,
      );

    case "deposit_balance":
      if (!config.depositBalanceConfig) {
        throw new ConvexError("Deposit/balance config is missing for deposit_balance payment");
      }
      return await createDepositBalanceInvoices(
        ctx,
        stripe,
        typedConfig,
        processingContext.stripeAccountId,
        processingContext.recipient.email,
        processingContext.recipient.name,
        processingContext.isPro,
        config.depositBalanceConfig,
      );

    case "recurring":
      if (!config.recurringConfig) {
        throw new ConvexError("Recurring config is missing for recurring payment");
      }
      return await createRecurringSubscription(
        ctx,
        stripe,
        typedConfig,
        processingContext.stripeAccountId,
        processingContext.recipient.email,
        processingContext.recipient.name,
        processingContext.isPro,
        config.recurringConfig,
      );

    case "installments":
      if (!config.installmentsConfig) {
        throw new ConvexError("Installments config is missing for installment payment");
      }
      return await createInstallmentSubscription(
        ctx,
        stripe,
        typedConfig,
        processingContext.stripeAccountId,
        processingContext.recipient.email,
        processingContext.recipient.name,
        processingContext.isPro,
        config.installmentsConfig,
      );

    default: {
      const exhaustiveCheck: never = config.paymentType;
      throw new ConvexError(`Unsupported payment type: "${String(exhaustiveCheck)}"`);
    }
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
    const configs: Doc<"payment_field_configs">[] = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId },
    );

    if (configs.length === 0) {
      return { invoiceLinks: [] };
    }

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

<<<<<<< HEAD
    const subscriptionStatus: { isPro: boolean; plan: "free" | "pro" } = await ctx.runQuery(
=======
    const subscriptionStatus = await ctx.runQuery(
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
      internal.auth.subscription_helpers.checkProFeature,
      { organizationId: args.organizationId },
    );

    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );
    const recipientMap = new Map(recipients.map((r) => [r._id.toString(), r]));

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

    for (const config of configs) {
      const recipient = resolvePaymentFieldRecipient(config, fieldMap, recipientMap);
      const result = await createStripeObjectsForConfig(ctx, stripe, config, {
        stripeAccountId: account.stripeAccountId,
        isPro: subscriptionStatus.isPro,
        recipient,
      });

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

// =====================
// PUBLIC ACTIONS (called from frontend, token-authenticated)
// =====================

/**
 * Retrieve the payment client_secret for an invoice, authenticated by recipient token.
 *
 * Called from the signing page when a signer needs to pay inline.
 * Uses Stripe's `confirmation_secret` expansion to get the PI's client_secret
 * without storing it in the DB (per Stripe's security guidance).
 */
export const getPaymentSecret = action({
  args: {
    token: v.string(),
    configId: v.id("payment_field_configs"),
  },
  handler: async (
    ctx,
    { token, configId },
  ): Promise<{ clientSecret: string; stripeAccountId: string }> => {
    // 1. Validate the recipient token
    const recipient = await ctx.runQuery(
      internal.documents.recipients_queries.findRecipientByTokenInternal,
      { signingToken: token },
    );
    if (!recipient) {
      throw new ConvexError("Invalid or expired token");
    }

    // 2. Get the payment config
    const config = await ctx.runQuery(internal.payment_fields.queries.getPaymentConfigInternal, {
      configId,
    });
    if (!config) {
      throw new ConvexError("Payment configuration not found");
    }

    // 3. Verify the recipient belongs to the same document as the payment config
    if (recipient.documentId !== config.documentId) {
      throw new ConvexError("Payment config does not belong to this document");
    }

    // 4. Verify payment is in a payable state
    if (config.paymentStatus === "paid" || config.paymentStatus === "cancelled") {
      throw new ConvexError("Payment is already completed or cancelled");
    }

    if (!config.stripeInvoiceId) {
      throw new ConvexError("Invoice not yet created");
    }

    // 5. Get the connected account's Stripe account ID
    const stripeAccount = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      { organizationId: config.organizationId },
    );
    if (!stripeAccount?.stripeAccountId) {
      throw new ConvexError("Stripe account not found for this organization");
    }

    // 6. Retrieve the invoice with confirmation_secret expansion
    const stripe = initializeStripe();
    const invoice = await stripe.invoices.retrieve(
      config.stripeInvoiceId,
      { expand: ["confirmation_secret"] },
      { stripeAccount: stripeAccount.stripeAccountId },
    );

    // The confirmation_secret contains the PaymentIntent's client_secret
    const confirmationSecret = (
      invoice as Stripe.Invoice & {
        confirmation_secret?: { client_secret: string };
      }
    ).confirmation_secret?.client_secret;

    if (!confirmationSecret) {
      throw new ConvexError("Unable to retrieve payment secret — invoice may not be finalized");
    }

    return {
      clientSecret: confirmationSecret,
      stripeAccountId: stripeAccount.stripeAccountId,
    };
  },
});
