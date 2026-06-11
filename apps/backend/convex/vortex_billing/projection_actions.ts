import { v } from "convex/values";
import { ConvexError } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type ActionCtx,
  type MutationCtx,
  internalAction,
  internalMutation,
} from "../_generated/server";
import type { SubscriptionStatus } from "../schemas/subscriptions";

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

type VortexSubscriptionProjectionResult = {
  readonly subscriptionId: Id<"subscriptions">;
  readonly organizationId: Id<"organizations">;
  readonly externalCustomerId: string;
  readonly externalSubscriptionId: string;
  readonly externalPriceId: string;
  readonly status: SubscriptionStatus;
};

type VortexSubscriptionProjectionEventResult =
  | {
      readonly duplicate: true;
      readonly result: null;
    }
  | {
      readonly duplicate: false;
      readonly result: VortexSubscriptionProjectionResult;
    };

const subscriptionStatuses = [
  "active",
  "canceled",
  "past_due",
  "trialing",
  "incomplete",
  "incomplete_expired",
  "unpaid",
] as const satisfies readonly SubscriptionStatus[];

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return subscriptionStatuses.some((status) => status === value);
}

async function resolveVortexSubscriptionOrganization(
  ctx: MutationCtx,
  args: {
    readonly sealOrganizationId?: string;
    readonly vortexCustomerId: string;
    readonly vortexSubscriptionId: string;
  },
): Promise<Id<"organizations">> {
  if (args.sealOrganizationId !== undefined) {
    const organization = await ctx.db.get(args.sealOrganizationId as Id<"organizations">);
    if (organization !== null) {
      return organization._id;
    }
  }

  const existingSubscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_external_subscription_id", (q) =>
      q.eq("externalSubscriptionId", args.vortexSubscriptionId),
    )
    .first();
  if (existingSubscription?.organizationId !== undefined) {
    return existingSubscription.organizationId;
  }

  const existingCustomerSubscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_external_customer_id", (q) => q.eq("externalCustomerId", args.vortexCustomerId))
    .first();
  if (existingCustomerSubscription?.organizationId !== undefined) {
    return existingCustomerSubscription.organizationId;
  }

  throw new ConvexError(
    `Seal organization not found for Vortex subscription ${args.vortexSubscriptionId}`,
  );
}

async function cancelOtherSealSubscriptions(
  ctx: MutationCtx,
  args: {
    readonly organizationId: Id<"organizations">;
    readonly currentSubscriptionId?: Id<"subscriptions">;
    readonly now: number;
  },
): Promise<void> {
  const activeSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", args.organizationId).eq("status", "active"),
    )
    .collect();
  for (const subscription of activeSubscriptions) {
    if (subscription._id === args.currentSubscriptionId) {
      continue;
    }
    await ctx.db.patch(subscription._id, {
      status: "canceled",
      canceledAt: args.now,
      cancelReason: "replaced_by_vortex_subscription",
      updatedAt: args.now,
    });
  }
}

function normalizeSubscriptionResult(
  subscription: Doc<"subscriptions">,
): VortexSubscriptionProjectionResult {
  if (!subscription.organizationId || !isSubscriptionStatus(subscription.status)) {
    throw new ConvexError("Vortex subscription projection wrote invalid subscription state");
  }
  return {
    subscriptionId: subscription._id,
    organizationId: subscription.organizationId,
    externalCustomerId: subscription.externalCustomerId,
    externalSubscriptionId: subscription.externalSubscriptionId,
    externalPriceId: subscription.externalPriceId,
    status: subscription.status,
  };
}

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

async function projectRecoveryState(
  ctx: ActionCtx,
  result: NonNullable<VortexPayableProjectionResult>,
): Promise<void> {
  if (!result.invoiceRecordId) {
    return;
  }

  if (result.paymentStatus === "failed") {
    await ctx.runMutation(internal.payment_fields.dunning.startDunning, {
      invoiceId: result.invoiceRecordId,
    });
    return;
  }

  if (result.paymentStatus === "paid" || result.paymentStatus === "cancelled") {
    await ctx.runMutation(internal.payment_fields.dunning.cancelDunning, {
      invoiceId: result.invoiceRecordId,
    });
  }
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

    if (result !== null) {
      await projectRecoveryState(ctx, result);
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

export const applyVortexSubscriptionUpdated = internalMutation({
  args: {
    vortexSubscriptionId: v.string(),
    vortexCustomerId: v.string(),
    vortexPriceId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("unpaid"),
    ),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    sealOrganizationId: v.optional(v.string()),
    latestInvoiceId: v.optional(v.string()),
    canceledAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexSubscriptionProjectionResult> => {
    const now = Date.now();
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.vortexSubscriptionId),
      )
      .first();
    const organizationId = await resolveVortexSubscriptionOrganization(ctx, args);

    if (args.status === "active" || args.status === "trialing") {
      await cancelOtherSealSubscriptions(ctx, {
        organizationId,
        currentSubscriptionId: existingSubscription?._id,
        now,
      });
    }

    if (existingSubscription !== null) {
      await ctx.db.patch(existingSubscription._id, {
        organizationId,
        externalCustomerId: args.vortexCustomerId,
        externalPriceId: args.vortexPriceId,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        canceledAt: args.canceledAt,
        cancelReason: args.cancelReason,
        latestInvoiceId: args.latestInvoiceId,
        updatedAt: now,
      });
      const updatedSubscription = await ctx.db.get(existingSubscription._id);
      if (updatedSubscription === null) {
        throw new ConvexError("Vortex subscription projection disappeared after update");
      }
      return normalizeSubscriptionResult(updatedSubscription);
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      organizationId,
      externalCustomerId: args.vortexCustomerId,
      externalSubscriptionId: args.vortexSubscriptionId,
      externalPriceId: args.vortexPriceId,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      canceledAt: args.canceledAt,
      cancelReason: args.cancelReason,
      latestInvoiceId: args.latestInvoiceId,
      createdAt: now,
      updatedAt: now,
    });
    const subscription = await ctx.db.get(subscriptionId);
    if (subscription === null) {
      throw new ConvexError("Vortex subscription projection disappeared after insert");
    }
    return normalizeSubscriptionResult(subscription);
  },
});

export const applyVortexSubscriptionUpdatedEvent = internalAction({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    vortexSubscriptionId: v.string(),
    vortexCustomerId: v.string(),
    vortexPriceId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("unpaid"),
    ),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    sealOrganizationId: v.optional(v.string()),
    latestInvoiceId: v.optional(v.string()),
    canceledAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexSubscriptionProjectionEventResult> => {
    const isProcessed = await ctx.runQuery(
      internal.vortex_billing.webhook_idempotency.isEventProcessed,
      { eventId: args.eventId },
    );
    if (isProcessed) {
      return { duplicate: true, result: null };
    }

    const result: VortexSubscriptionProjectionResult = await ctx.runMutation(
      internal.vortex_billing.projection_actions.applyVortexSubscriptionUpdated,
      {
        vortexSubscriptionId: args.vortexSubscriptionId,
        vortexCustomerId: args.vortexCustomerId,
        vortexPriceId: args.vortexPriceId,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        sealOrganizationId: args.sealOrganizationId,
        latestInvoiceId: args.latestInvoiceId,
        canceledAt: args.canceledAt,
        cancelReason: args.cancelReason,
      },
    );

    await ctx.runMutation(internal.vortex_billing.webhook_idempotency.markEventProcessed, {
      eventId: args.eventId,
      eventType: args.eventType,
    });

    return { duplicate: false, result };
  },
});
