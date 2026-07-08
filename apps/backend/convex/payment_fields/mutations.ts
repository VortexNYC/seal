import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import {
  dueDateTermsTuple,
  type PaymentStatus,
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
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new ConvexError("Payment config not found");
    }

    await ctx.db.patch(args.configId, {
      paymentStatus: args.paymentStatus,
      ...(args.providerInvoiceId !== undefined && { providerInvoiceId: args.providerInvoiceId }),
      ...(args.providerSubscriptionId !== undefined && {
        providerSubscriptionId: args.providerSubscriptionId,
      }),
      ...(args.providerPaymentIntentId !== undefined && {
        providerPaymentIntentId: args.providerPaymentIntentId,
      }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update payment status from Vortex Billing webhook handlers.
 * Looks up the config by providerInvoiceId (set during the send flow).
 * Returns the config ID and documentId if found, or null if not found.
 */
export const updatePaymentStatusFromProviderInvoice = internalMutation({
  args: {
    providerInvoiceId: v.string(),
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
      .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", args.providerInvoiceId))
      .first();

    // Always look up document_invoices — cycle 2+ invoices may exist here
    // even when config doesn't match (config stores the initial invoice ID)
    const invoiceRecord = await ctx.db
      .query("document_invoices")
      .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", args.providerInvoiceId))
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

type DocumentInvoiceWebhookStatus = "open" | "paid" | "void" | "uncollectible";

type PaymentWebhookUpdateResult = {
  readonly configId: Id<"payment_field_configs"> | undefined;
  readonly documentId: Id<"documents"> | undefined;
  readonly invoiceRecordId: Id<"document_invoices"> | undefined;
};

const documentInvoiceStatusByPaymentStatus: Partial<
  Record<PaymentStatus, DocumentInvoiceWebhookStatus>
> = {
  awaiting: "open",
  paid: "paid",
  failed: "uncollectible",
  cancelled: "void",
};

function isTerminalInvoiceStatus(status: string): boolean {
  return status === "paid" || status === "void" || status === "uncollectible";
}

function isTerminalPaymentStatus(status: PaymentStatus | undefined): boolean {
  return status === "paid" || status === "failed" || status === "cancelled";
}

function shouldSkipTerminalInvoiceUpdate(
  currentStatus: string,
  incomingStatus: DocumentInvoiceWebhookStatus,
): boolean {
  if (!isTerminalInvoiceStatus(currentStatus)) {
    return false;
  }
  if (currentStatus === "uncollectible" && incomingStatus === "paid") {
    return false;
  }
  return currentStatus !== incomingStatus;
}

function shouldSkipTerminalConfigUpdate(
  currentStatus: PaymentStatus | undefined,
  incomingStatus: PaymentStatus,
): boolean {
  if (!isTerminalPaymentStatus(currentStatus)) {
    return false;
  }
  if (currentStatus === "failed" && incomingStatus === "paid") {
    return false;
  }
  return currentStatus !== incomingStatus;
}

export async function updateVortexPaymentStatusFromWebhookInDb(
  ctx: Pick<MutationCtx, "db">,
  args: {
    readonly vortexPayableId: string;
    readonly paymentStatus: PaymentStatus;
  },
): Promise<PaymentWebhookUpdateResult | null> {
  const now = Date.now();
  const invoiceStatus = documentInvoiceStatusByPaymentStatus[args.paymentStatus];

  // Correlate strictly by vortexPayableId. The by_vortex_payable indexes are not unique, so a
  // money webhook must FAIL CLOSED on any ambiguity rather than "join by hope": refuse if a payable
  // id maps to more than one config/invoice, or if the config and invoice disagree on the document
  // (a document belongs to exactly one org, so a documentId match is the tenant/correlation guard).
  const configMatches = await ctx.db
    .query("payment_field_configs")
    .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", args.vortexPayableId))
    .collect();
  if (configMatches.length > 1) {
    throw new Error(
      `ambiguous vortexPayableId across payment_field_configs: ${args.vortexPayableId}`,
    );
  }
  const config = configMatches[0] ?? null;

  const invoiceMatches = await ctx.db
    .query("document_invoices")
    .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", args.vortexPayableId))
    .collect();
  if (invoiceMatches.length > 1) {
    throw new Error(`ambiguous vortexPayableId across document_invoices: ${args.vortexPayableId}`);
  }
  const invoiceRecord = invoiceMatches[0] ?? null;

  if (!config && !invoiceRecord) {
    return null;
  }

  if (config && invoiceRecord && config.documentId !== invoiceRecord.documentId) {
    throw new Error(
      `vortexPayableId ${args.vortexPayableId} maps to mismatched documents (config ${config.documentId} vs invoice ${invoiceRecord.documentId})`,
    );
  }

  if (
    invoiceRecord &&
    invoiceStatus !== undefined &&
    shouldSkipTerminalInvoiceUpdate(invoiceRecord.status, invoiceStatus)
  ) {
    return {
      configId: config?._id,
      documentId: config?.documentId ?? invoiceRecord.documentId,
      invoiceRecordId: invoiceRecord._id,
    };
  }

  if (
    !invoiceRecord &&
    config &&
    shouldSkipTerminalConfigUpdate(config.paymentStatus, args.paymentStatus)
  ) {
    return {
      configId: config._id,
      documentId: config.documentId,
      invoiceRecordId: undefined,
    };
  }

  if (config) {
    await ctx.db.patch(config._id, {
      paymentStatus: args.paymentStatus,
      updatedAt: now,
    });
  }

  if (invoiceRecord && invoiceStatus !== undefined) {
    await ctx.db.patch(invoiceRecord._id, {
      status: invoiceStatus,
      ...(invoiceStatus === "paid" && { paidAt: now }),
      ...(invoiceStatus === "void" && { voidedAt: now }),
      ...(invoiceStatus === "open" &&
        invoiceRecord.finalizedAt === undefined && {
          finalizedAt: now,
        }),
      updatedAt: now,
    });
  }

  return {
    configId: config?._id,
    documentId: config?.documentId ?? invoiceRecord?.documentId,
    invoiceRecordId: invoiceRecord?._id,
  };
}

export const updateVortexPaymentStatusFromWebhook = internalMutation({
  args: {
    vortexPayableId: v.string(),
    paymentStatus: paymentStatusTuple,
  },
  handler: async (ctx, args): Promise<PaymentWebhookUpdateResult | null> => {
    return await updateVortexPaymentStatusFromWebhookInDb(ctx, args);
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
        q.eq("providerSubscriptionId", args.providerSubscriptionId),
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
 * Internal mutation to store provider IDs back on a payment config
 * after provider objects are created during the send flow.
 * Also creates a document_invoices record for revenue tracking.
 */
export const storeProviderPaymentIds = internalMutation({
  args: {
    configId: v.id("payment_field_configs"),
    paymentStatus: paymentStatusTuple,
    providerInvoiceId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    providerPaymentIntentId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    // Fields for document_invoices record
    providerAccountId: v.optional(v.string()),
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
      ...(args.providerInvoiceId !== undefined && { providerInvoiceId: args.providerInvoiceId }),
      ...(args.providerSubscriptionId !== undefined && {
        providerSubscriptionId: args.providerSubscriptionId,
      }),
      ...(args.providerPaymentIntentId !== undefined && {
        providerPaymentIntentId: args.providerPaymentIntentId,
      }),
      ...(args.hostedInvoiceUrl !== undefined && { hostedInvoiceUrl: args.hostedInvoiceUrl }),
      updatedAt: now,
    });

    // Create document_invoices record for revenue tracking
    if (args.providerInvoiceId && args.providerAccountId && args.customerEmail) {
      // Check if record already exists (idempotent)
      const existing = await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) =>
          q.eq("providerInvoiceId", sealAssertPresent(args.providerInvoiceId)),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("document_invoices", {
          documentId: config.documentId,
          organizationId: config.organizationId,
          providerAccountId: args.providerAccountId,
          providerInvoiceId: args.providerInvoiceId,
          providerSubscriptionId: args.providerSubscriptionId,
          providerCustomerId: undefined,
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
 * Internal mutation to store Vortex Billing payable IDs back on a payment config
 * after Vortex creates the payable and manual payment request during send.
 * Also creates a document_invoices record for revenue tracking.
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
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new ConvexError("Payment config not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.configId, {
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
      ...(args.hostedInvoiceUrl !== undefined && { hostedInvoiceUrl: args.hostedInvoiceUrl }),
      updatedAt: now,
    });

    const invoiceStatus = documentInvoiceStatusForPaymentStatus(args.paymentStatus);
    const existing = await ctx.db
      .query("document_invoices")
      .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", args.vortexPayableId))
      .first();

    if (existing) {
      const terminalStatuses = new Set(["paid", "void", "uncollectible"]);
      if (terminalStatuses.has(existing.status)) {
        return null;
      }

      await ctx.db.patch(existing._id, {
        status: invoiceStatus,
        vortexPaymentRequestId: args.vortexPaymentRequestId,
        amountDue: config.totalAmountCents,
        hostedInvoiceUrl: args.hostedInvoiceUrl,
        ...(invoiceStatus === "open" && existing.finalizedAt === undefined && { finalizedAt: now }),
        updatedAt: now,
      });
      return null;
    }

    await ctx.db.insert("document_invoices", {
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
    });

    return null;
  },
});

function documentInvoiceStatusForPaymentStatus(
  paymentStatus: "pending" | "created" | "awaiting" | "paid" | "failed" | "cancelled",
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
  }
}

/**
 * Internal mutation to upsert a document_invoices record from a Vortex Billing
 * subscription invoice webhook (invoice.created / invoice.finalized).
 *
 * For recurring payments, Vortex Billing generates new invoices each billing cycle.
 * This mutation links those subsequent invoices back to the original document
 * by looking up the payment_field_config via providerSubscriptionId.
 *
 * Idempotent — won't create duplicates for the same providerInvoiceId.
 */
export const upsertRecurringInvoice = internalMutation({
  args: {
    providerInvoiceId: v.string(),
    providerSubscriptionId: v.string(),
    providerCustomerId: v.optional(v.string()),
    providerAccountId: v.string(),
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
      .withIndex("by_provider_subscription", (q) =>
        q.eq("providerSubscriptionId", args.providerSubscriptionId),
      )
      .first();

    if (!config) {
      return null;
    }

    const now = Date.now();

    // Check if record already exists (idempotent)
    const existing = await ctx.db
      .query("document_invoices")
      .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", args.providerInvoiceId))
      .first();

    if (existing) {
      // Never regress terminal statuses (paid, void, uncollectible) on replayed events
      const terminalStatuses = new Set(["paid", "void", "uncollectible"]);
      if (terminalStatuses.has(existing.status)) {
        return { invoiceId: existing._id, created: false };
      }

      // Update existing record with latest data from Vortex Billing
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
      providerAccountId: args.providerAccountId,
      providerInvoiceId: args.providerInvoiceId,
      providerSubscriptionId: args.providerSubscriptionId,
      providerCustomerId: args.providerCustomerId,
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
