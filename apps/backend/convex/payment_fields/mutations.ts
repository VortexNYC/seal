import { ConvexError, v } from "convex/values";

import { internalMutation, mutation } from "../_generated/server";
import {
  dueDateTermsTuple,
  paymentMethodTuple,
  paymentStatusTuple,
  paymentTypeTuple,
} from "../schemas/payment_field_configs";
import { computeTotalAmountCents, validatePaymentConfig } from "./helpers";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/**
 * Payment Field Config Mutations
 *
 * Create/update/delete payment configurations tied to payment-type signature fields.
 */

const lineItemArg = v.object({
  id: v.string(),
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  stripeProductId: v.optional(v.string()),
  stripePriceId: v.optional(v.string()),
});

const lateFeeArg = v.object({
  enabled: v.boolean(),
  type: v.union(v.literal("percentage"), v.literal("fixed")),
  amount: v.number(),
  gracePeriodDays: v.number(),
});

const recurringConfigArg = v.object({
  interval: v.union(v.literal("week"), v.literal("month"), v.literal("year")),
  intervalCount: v.number(),
  endCondition: v.union(v.literal("never"), v.literal("after_count"), v.literal("on_date")),
  endAfterCount: v.optional(v.number()),
  endOnDate: v.optional(v.number()),
});

const installmentsConfigArg = v.object({
  count: v.number(),
  interval: v.union(v.literal("week"), v.literal("month")),
  firstPaymentAmount: v.optional(v.number()),
});

const depositBalanceConfigArg = v.object({
  depositPercent: v.number(),
  balanceDueDays: v.number(),
});

/**
 * Upsert a payment configuration for a payment field.
 * Creates a new config or updates the existing one.
 */
export const upsertPaymentConfig = mutation({
  args: {
    fieldId: v.id("signature_fields"),
    paymentType: paymentTypeTuple,
    items: v.array(lineItemArg),
    currency: v.string(),
    dueDateTerms: dueDateTermsTuple,
    customDueDays: v.optional(v.number()),
    customDueDate: v.optional(v.string()),
    lateFees: v.optional(lateFeeArg),
    recurringConfig: v.optional(recurringConfigArg),
    installmentsConfig: v.optional(installmentsConfigArg),
    depositBalanceConfig: v.optional(depositBalanceConfigArg),
    allowedPaymentMethods: v.array(paymentMethodTuple),
    feeHandling: v.union(v.literal("absorb"), v.literal("pass_to_recipient")),
    taxEnabled: v.boolean(),
    taxBehavior: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Verify the field exists and is a payment field
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new ConvexError("Field not found");
    }
    if (field.fieldType !== "payment") {
      throw new ConvexError("Field is not a payment field");
    }

    // Get document to verify draft status and get organizationId
    const document = await ctx.db.get(field.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }
    if ((document.workflowStatus ?? "draft") !== "draft") {
      throw new ConvexError("Payment config can only be modified in draft status");
    }

    // Compute total
    const totalAmountCents = computeTotalAmountCents(args.items);

    // Validate the config
    const validationError = validatePaymentConfig({
      paymentType: args.paymentType,
      items: args.items,
      totalAmountCents,
      allowedPaymentMethods: args.allowedPaymentMethods,
      recurringConfig: args.recurringConfig,
      installmentsConfig: args.installmentsConfig,
      depositBalanceConfig: args.depositBalanceConfig,
    });

    if (validationError) {
      throw new ConvexError(validationError);
    }

    // Check for existing config
    const existing = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .unique();

    const now = Date.now();

    if (existing) {
      // Update existing config
      await ctx.db.patch(existing._id, {
        paymentType: args.paymentType,
        items: args.items,
        currency: args.currency.toLowerCase(),
        dueDateTerms: args.dueDateTerms,
        customDueDays: args.customDueDays,
        customDueDate: args.customDueDate,
        lateFees: args.lateFees,
        recurringConfig: args.recurringConfig,
        installmentsConfig: args.installmentsConfig,
        depositBalanceConfig: args.depositBalanceConfig,
        allowedPaymentMethods: args.allowedPaymentMethods,
        feeHandling: args.feeHandling,
        taxEnabled: args.taxEnabled,
        taxBehavior: args.taxBehavior,
        totalAmountCents,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new config
    const configId = await ctx.db.insert("payment_field_configs", {
      fieldId: args.fieldId,
      documentId: field.documentId,
      organizationId: document.organizationId,
      paymentType: args.paymentType,
      items: args.items,
      currency: args.currency.toLowerCase(),
      dueDateTerms: args.dueDateTerms,
      customDueDays: args.customDueDays,
      customDueDate: args.customDueDate,
      lateFees: args.lateFees,
      recurringConfig: args.recurringConfig,
      installmentsConfig: args.installmentsConfig,
      depositBalanceConfig: args.depositBalanceConfig,
      allowedPaymentMethods: args.allowedPaymentMethods,
      feeHandling: args.feeHandling,
      taxEnabled: args.taxEnabled,
      taxBehavior: args.taxBehavior,
      totalAmountCents,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return configId;
  },
});

/**
 * Delete a payment configuration when its field is deleted.
 */
export const deletePaymentConfig = mutation({
  args: {
    fieldId: v.id("signature_fields"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

/**
 * Update payment status (called by Stripe webhook handlers).
 */
export const updatePaymentStatus = mutation({
  args: {
    configId: v.id("payment_field_configs"),
    paymentStatus: paymentStatusTuple,
    stripeInvoiceId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new ConvexError("Payment config not found");
    }

    await ctx.db.patch(args.configId, {
      paymentStatus: args.paymentStatus,
      ...(args.stripeInvoiceId !== undefined && { stripeInvoiceId: args.stripeInvoiceId }),
      ...(args.stripeSubscriptionId !== undefined && {
        stripeSubscriptionId: args.stripeSubscriptionId,
      }),
      ...(args.stripePaymentIntentId !== undefined && {
        stripePaymentIntentId: args.stripePaymentIntentId,
      }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update payment status from Stripe webhook handlers.
 * Looks up the config by stripeInvoiceId (set during the send flow).
 * Returns the config ID and documentId if found, or null if not found.
 */
export const updatePaymentStatusFromWebhook = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    paymentStatus: paymentStatusTuple,
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const statusMap: Record<string, "open" | "paid" | "void" | "uncollectible"> = {
      awaiting: "open",
      paid: "paid",
      failed: "uncollectible",
      cancelled: "void",
    };

    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    // Always look up document_invoices — cycle 2+ invoices may exist here
    // even when config doesn't match (config stores the initial invoice ID)
    const invoiceRecord = await ctx.db
      .query("document_invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    if (config) {
      await ctx.db.patch(config._id, {
        paymentStatus: args.paymentStatus,
        updatedAt: now,
      });
    }

    if (invoiceRecord) {
      const invoiceStatus = statusMap[args.paymentStatus];
      if (invoiceStatus) {
        await ctx.db.patch(invoiceRecord._id, {
          status: invoiceStatus,
          ...(invoiceStatus === "paid" && { paidAt: now }),
          ...(invoiceStatus === "void" && { voidedAt: now }),
          updatedAt: now,
        });
      }
    }

    // Return null only if neither config nor invoice record was found
    if (!config && !invoiceRecord) {
      return null;
    }

    return {
      configId: config?._id,
      documentId: config?.documentId ?? invoiceRecord?.documentId,
      invoiceRecordId: invoiceRecord?._id,
    };
  },
});

/**
 * Internal mutation to update payment status from Stripe subscription webhooks.
 * Looks up the config by stripeSubscriptionId.
 * Returns the config ID if found and updated, or null if not found.
 */
export const updatePaymentStatusFromSubscriptionWebhook = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    paymentStatus: paymentStatusTuple,
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (!config) {
      return null;
    }

    await ctx.db.patch(config._id, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });

    return config._id;
  },
});

/**
 * Internal mutation to store Stripe IDs back on a payment config
 * after Stripe objects are created during the send flow.
 * Also creates a document_invoices record for revenue tracking.
 */
export const storeStripeIds = internalMutation({
  args: {
    configId: v.id("payment_field_configs"),
    paymentStatus: paymentStatusTuple,
    stripeInvoiceId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    // Fields for document_invoices record
    stripeAccountId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new ConvexError("Payment config not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.configId, {
      paymentStatus: args.paymentStatus,
      ...(args.stripeInvoiceId !== undefined && { stripeInvoiceId: args.stripeInvoiceId }),
      ...(args.stripeSubscriptionId !== undefined && {
        stripeSubscriptionId: args.stripeSubscriptionId,
      }),
      ...(args.stripePaymentIntentId !== undefined && {
        stripePaymentIntentId: args.stripePaymentIntentId,
      }),
      ...(args.hostedInvoiceUrl !== undefined && { hostedInvoiceUrl: args.hostedInvoiceUrl }),
      updatedAt: now,
    });

    // Create document_invoices record for revenue tracking
    if (args.stripeInvoiceId && args.stripeAccountId && args.customerEmail) {
      // Check if record already exists (idempotent)
      const existing = await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) =>
          q.eq("stripeInvoiceId", sealAssertPresent(args.stripeInvoiceId)),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("document_invoices", {
          documentId: config.documentId,
          organizationId: config.organizationId,
          stripeAccountId: args.stripeAccountId,
          stripeInvoiceId: args.stripeInvoiceId,
          stripeSubscriptionId: args.stripeSubscriptionId,
          stripeCustomerId: undefined,
          status: "open",
          customerEmail: args.customerEmail,
          customerName: args.customerName,
          amountDue: config.totalAmountCents,
          currency: config.currency,
          hostedInvoiceUrl: args.hostedInvoiceUrl,
          finalizedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Internal mutation to upsert a document_invoices record from a Stripe
 * subscription invoice webhook (invoice.created / invoice.finalized).
 *
 * For recurring payments, Stripe generates new invoices each billing cycle.
 * This mutation links those subsequent invoices back to the original document
 * by looking up the payment_field_config via stripeSubscriptionId.
 *
 * Idempotent — won't create duplicates for the same stripeInvoiceId.
 */
export const upsertRecurringInvoice = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeAccountId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("uncollectible"),
    ),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    amountDue: v.number(),
    currency: v.string(),
    hostedInvoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Look up payment_field_config by subscription to get documentId/organizationId
    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (!config) {
      return null;
    }

    const now = Date.now();

    // Check if record already exists (idempotent)
    const existing = await ctx.db
      .query("document_invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    if (existing) {
      // Never regress terminal statuses (paid, void, uncollectible) on replayed events
      const terminalStatuses = new Set(["paid", "void", "uncollectible"]);
      if (terminalStatuses.has(existing.status)) {
        return { invoiceId: existing._id, created: false };
      }

      // Update existing record with latest data from Stripe
      await ctx.db.patch(existing._id, {
        status: args.status,
        amountDue: args.amountDue,
        hostedInvoiceUrl: args.hostedInvoiceUrl,
        invoicePdf: args.invoicePdf,
        ...(args.status === "open" && !existing.finalizedAt && { finalizedAt: now }),
        updatedAt: now,
      });
      return { invoiceId: existing._id, created: false };
    }

    // Create new document_invoices record
    const invoiceId = await ctx.db.insert("document_invoices", {
      documentId: config.documentId,
      organizationId: config.organizationId,
      stripeAccountId: args.stripeAccountId,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      status: args.status,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      amountDue: args.amountDue,
      currency: args.currency,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      invoicePdf: args.invoicePdf,
      ...(args.status === "open" && { finalizedAt: now }),
      createdAt: now,
      updatedAt: now,
    });

    return { invoiceId, created: true };
  },
});
