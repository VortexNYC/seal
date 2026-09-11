import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { type Doc } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";
import {
  dueDateTermsTuple,
  paymentMethodTuple,
  paymentStatusTuple,
  paymentTypeTuple,
} from "../schemas/payment_field_configs";
import { computeTotalAmountCents, validatePaymentConfig } from "./helpers";

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
  providerProductId: v.optional(v.string()),
  providerPriceId: v.optional(v.string()),
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
  endCondition: v.union(
    v.literal("never"),
    v.literal("after_count"),
    v.literal("on_date")
  ),
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
    taxBehavior: v.optional(
      v.union(v.literal("inclusive"), v.literal("exclusive"))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Verify the field exists and is a payment field
    const field = await ctx.db.get("signature_fields", args.fieldId);
    if (!field) {
      throw new ConvexError("Field not found");
    }
    if (field.fieldType !== "payment") {
      throw new ConvexError("Field is not a payment field");
    }

    // Get document to verify draft status and get organizationId
    const document = await ctx.db.get("documents", field.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }
    if ((document.workflowStatus ?? "draft") !== "draft") {
      throw new ConvexError(
        "Payment config can only be modified in draft status"
      );
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
      await ctx.db.patch("payment_field_configs", existing._id, {
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
      const updated = await ctx.db.get("payment_field_configs", existing._id);
      if (updated) {
        await ctx.scheduler.runAfter(
          0,
          internal.payment_fields.worker_payment_configs
            .createPaymentFieldConfig,
          toWorkerPaymentFieldConfig(updated)
        );
      }
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

    const config = await ctx.db.get("payment_field_configs", configId);
    if (config) {
      await ctx.scheduler.runAfter(
        0,
        internal.payment_fields.worker_payment_configs.createPaymentFieldConfig,
        toWorkerPaymentFieldConfig(config)
      );
    }

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
      await ctx.db.delete("payment_field_configs", existing._id);
    }

    return { success: true };
  },
});

/**
 * Update payment status (called by Vortex Billing webhook handlers).
 */
export const updatePaymentStatus = mutation({
  args: {
    configId: v.id("payment_field_configs"),
    paymentStatus: paymentStatusTuple,
    providerInvoiceId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    providerPaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get("payment_field_configs", args.configId);
    if (!config) {
      throw new ConvexError("Payment config not found");
    }

    const now = Date.now();
    await ctx.db.patch("payment_field_configs", args.configId, {
      paymentStatus: args.paymentStatus,
      ...(args.providerInvoiceId !== undefined && {
        providerInvoiceId: args.providerInvoiceId,
      }),
      ...(args.providerSubscriptionId !== undefined && {
        providerSubscriptionId: args.providerSubscriptionId,
      }),
      ...(args.providerPaymentIntentId !== undefined && {
        providerPaymentIntentId: args.providerPaymentIntentId,
      }),
      updatedAt: now,
    });

    const updated = await ctx.db.get("payment_field_configs", args.configId);
    if (updated) {
      await ctx.scheduler.runAfter(
        0,
        internal.payment_fields.worker_payment_configs.createPaymentFieldConfig,
        toWorkerPaymentFieldConfig(updated)
      );
    }

    return { success: true };
  },
});

/**
 * Internal mutation to update payment status from Vortex Billing subscription webhooks.
 * Looks up the config by providerSubscriptionId.
 * Returns the config ID if found and updated, or null if not found.
 */
export const updatePaymentStatusFromProviderSubscription = internalMutation({
  args: {
    providerSubscriptionId: v.string(),
    paymentStatus: paymentStatusTuple,
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_provider_subscription", (q) =>
        q.eq("providerSubscriptionId", args.providerSubscriptionId)
      )
      .first();

    if (!config) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("payment_field_configs", config._id, {
      paymentStatus: args.paymentStatus,
      updatedAt: now,
    });

    const updated = await ctx.db.get("payment_field_configs", config._id);
    if (updated) {
      await ctx.scheduler.runAfter(
        0,
        internal.payment_fields.worker_payment_configs.createPaymentFieldConfig,
        toWorkerPaymentFieldConfig(updated)
      );
    }

    return config._id;
  },
});

/**
 * Internal mutation to store Vortex Billing payable IDs back on a payment config
 * after Vortex creates the payable and manual payment request during send.
 * Also creates the D1 document invoice record via createDocumentInvoice.
 */
export const storeVortexPayableIds = internalMutation({
  args: {
    configId: v.id("payment_field_configs"),
    paymentStatus: paymentStatusTuple,
    vortexPayableId: v.string(),
    vortexRecurringPayableId: v.optional(v.string()),
    vortexInstallmentPayableId: v.optional(v.string()),
    vortexDepositBalancePayableId: v.optional(v.string()),
    vortexPaymentRequestId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = await ctx.db.get("payment_field_configs", args.configId);
    if (!config) {
      throw new ConvexError("Payment config not found");
    }

    const now = Date.now();

    await ctx.db.patch("payment_field_configs", args.configId, {
      paymentStatus: args.paymentStatus,
      vortexPayableId: args.vortexPayableId,
      ...(args.vortexRecurringPayableId !== undefined && {
        vortexRecurringPayableId: args.vortexRecurringPayableId,
      }),
      ...(args.vortexInstallmentPayableId !== undefined && {
        vortexInstallmentPayableId: args.vortexInstallmentPayableId,
      }),
      ...(args.vortexDepositBalancePayableId !== undefined && {
        vortexDepositBalancePayableId: args.vortexDepositBalancePayableId,
      }),
      ...(args.vortexPaymentRequestId !== undefined && {
        vortexPaymentRequestId: args.vortexPaymentRequestId,
      }),
      ...(args.hostedInvoiceUrl !== undefined && {
        hostedInvoiceUrl: args.hostedInvoiceUrl,
      }),
      updatedAt: now,
    });

    const updated = await ctx.db.get("payment_field_configs", args.configId);
    if (updated) {
      await ctx.scheduler.runAfter(
        0,
        internal.payment_fields.worker_payment_configs.createPaymentFieldConfig,
        toWorkerPaymentFieldConfig(updated)
      );
    }

    const invoiceStatus = documentInvoiceStatusForPaymentStatus(
      args.paymentStatus
    );

    await ctx.scheduler.runAfter(
      0,
      internal.payment_fields.worker_invoices.createDocumentInvoice,
      {
        id: args.vortexPayableId,
        documentId: config.documentId,
        organizationId: config.organizationId,
        provider: "vortex_billing",
        vortexPayableId: args.vortexPayableId,
        vortexPaymentRequestId: args.vortexPaymentRequestId,
        status: invoiceStatus,
        customerEmail: args.customerEmail,
        customerName: args.customerName,
        amountDue: config.totalAmountCents,
        currency: config.currency,
        hostedInvoiceUrl: args.hostedInvoiceUrl,
        ...(invoiceStatus === "open" && { finalizedAt: now }),
        createdAt: now,
        updatedAt: now,
      }
    );

    return null;
  },
});

function documentInvoiceStatusForPaymentStatus(
  paymentStatus:
    | "pending"
    | "created"
    | "awaiting"
    | "paid"
    | "failed"
    | "cancelled"
): "draft" | "open" | "paid" | "void" | "uncollectible" {
  switch (paymentStatus) {
    case "pending":
    case "created":
      return "draft";
    case "awaiting":
      return "open";
    case "paid":
      return "paid";
    case "failed":
      return "uncollectible";
    case "cancelled":
      return "void";
    default: {
      const _exhaustive: never = paymentStatus;
      throw new Error(`Unhandled payment status: ${String(_exhaustive)}`);
    }
  }
}

function toWorkerPaymentFieldConfig(config: Doc<"payment_field_configs">) {
  return {
    id: config._id,
    publicId: config._id,
    fieldId: config.fieldId,
    documentId: config.documentId,
    organizationId: config.organizationId,
    paymentType: config.paymentType,
    items: JSON.stringify(config.items),
    currency: config.currency,
    dueDateTerms: config.dueDateTerms,
    customDueDays: config.customDueDays,
    customDueDate: config.customDueDate,
    lateFees: config.lateFees ? JSON.stringify(config.lateFees) : undefined,
    recurringConfig: config.recurringConfig
      ? JSON.stringify(config.recurringConfig)
      : undefined,
    installmentsConfig: config.installmentsConfig
      ? JSON.stringify(config.installmentsConfig)
      : undefined,
    depositBalanceConfig: config.depositBalanceConfig
      ? JSON.stringify(config.depositBalanceConfig)
      : undefined,
    allowedPaymentMethods: JSON.stringify(config.allowedPaymentMethods),
    feeHandling: config.feeHandling,
    taxEnabled: config.taxEnabled,
    taxBehavior: config.taxBehavior,
    totalAmountCents: config.totalAmountCents,
    providerInvoiceId: config.providerInvoiceId,
    providerSubscriptionId: config.providerSubscriptionId,
    providerPaymentIntentId: config.providerPaymentIntentId,
    hostedInvoiceUrl: config.hostedInvoiceUrl,
    vortexPayableId: config.vortexPayableId,
    vortexDepositBalancePayableId: config.vortexDepositBalancePayableId,
    vortexInstallmentPayableId: config.vortexInstallmentPayableId,
    vortexRecurringPayableId: config.vortexRecurringPayableId,
    vortexPaymentRequestId: config.vortexPaymentRequestId,
    paymentStatus: config.paymentStatus,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}
