import { v } from "convex/values";
import { ConvexError } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

type VortexPayableProjectionResult = {
  readonly configId: Id<"payment_field_configs">;
  readonly documentId: Id<"documents">;
  readonly paymentStatus: "pending" | "created" | "awaiting" | "paid" | "failed" | "cancelled";
  readonly invoiceRecordId?: Id<"document_invoices">;
} | null;

type VortexPayableProjectionEventResult =
  | {
      readonly duplicate: true;
      readonly result: null;
    }
  | {
      readonly duplicate: false;
      readonly result: VortexPayableProjectionResult;
    };

function isSealPaymentStatus(
  value: unknown,
): value is NonNullable<VortexPayableProjectionResult>["paymentStatus"] {
  return (
    value === "pending" ||
    value === "created" ||
    value === "awaiting" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled"
  );
}

function normalizeProjectionResult(
  value: {
    readonly configId: Id<"payment_field_configs">;
    readonly documentId: Id<"documents">;
    readonly paymentStatus?: unknown;
    readonly invoiceRecordId?: Id<"document_invoices">;
  } | null,
): VortexPayableProjectionResult {
  if (value === null) {
    return null;
  }
  if (!isSealPaymentStatus(value.paymentStatus)) {
    throw new ConvexError("Vortex payable projection returned an invalid Seal payment status");
  }
  return {
    configId: value.configId,
    documentId: value.documentId,
    paymentStatus: value.paymentStatus,
    invoiceRecordId: value.invoiceRecordId,
  };
}

export const applyVortexPayableUpdated = internalAction({
  args: {
    vortexPayableId: v.string(),
    vortexStatus: v.string(),
    vortexPaymentRequestId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexPayableProjectionResult> => {
    const result = normalizeProjectionResult(
      await ctx.runMutation(
        internal.payment_fields.mutations.updatePaymentStatusFromVortexPayable,
        args,
      ),
    );

    if (result?.paymentStatus === "paid") {
      await ctx.runMutation(
        internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize,
        {
          documentId: result.documentId,
        },
      );
    }

    return result;
  },
});

export const applyVortexPayableUpdatedEvent = internalAction({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    vortexPayableId: v.string(),
    vortexStatus: v.string(),
    vortexPaymentRequestId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexPayableProjectionEventResult> => {
    const isProcessed = await ctx.runQuery(
      internal.vortex_billing.webhook_idempotency.isEventProcessed,
      { eventId: args.eventId },
    );
    if (isProcessed) {
      return { duplicate: true, result: null };
    }

    const result: VortexPayableProjectionResult = await ctx.runAction(
      internal.vortex_billing.projection_actions.applyVortexPayableUpdated,
      {
        vortexPayableId: args.vortexPayableId,
        vortexStatus: args.vortexStatus,
        vortexPaymentRequestId: args.vortexPaymentRequestId,
        hostedInvoiceUrl: args.hostedInvoiceUrl,
      },
    );

    await ctx.runMutation(internal.vortex_billing.webhook_idempotency.markEventProcessed, {
      eventId: args.eventId,
      eventType: args.eventType,
    });

    return { duplicate: false, result };
  },
});
