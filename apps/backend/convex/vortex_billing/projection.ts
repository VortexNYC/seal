import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { SubscriptionStatus } from "../schemas/subscriptions";
import { resolveSubscriptionPriceByAnyId } from "../subscription_price_resolver";

export type VortexSubscriptionProjectionResult = {
  readonly processed: boolean;
  readonly duplicate: boolean;
  readonly ignored?: boolean;
  readonly organizationId: Id<"organizations">;
  readonly externalSubscriptionId: string;
  readonly activeNonVortexProviderIdPresent: boolean;
};

export type VortexInvoiceProjectionResult = {
  readonly processed: boolean;
  readonly duplicate: boolean;
  readonly ignored: boolean;
  readonly externalSubscriptionId?: string;
};

type UnknownRecord = Readonly<Record<string, unknown>>;
type VortexInvoiceEventType = "invoice.paid" | "invoice.payment_failed";
type VortexPayableObjectStatus = "paid" | "failed" | "awaiting_payment";

type VortexInvoiceEventInput = UnknownRecord & {
  readonly id: string;
  readonly type: string;
  readonly createdAt?: number;
  readonly data?: unknown;
};

export type VortexInvoiceProjection = {
  readonly eventId: string;
  readonly eventType: VortexInvoiceEventType;
  readonly subscriptionExternalId?: string;
  readonly invoiceNumber: string;
  readonly invoiceStatus: string;
  readonly sourceCreatedAt?: number;
};

export type VortexPayableObjectProjection = {
  readonly eventId: string;
  readonly payableId: string;
  readonly status: VortexPayableObjectStatus;
  readonly paymentRequestId?: string;
  readonly hostedInvoiceUrl?: string;
};

const nonVortexProviderIdPattern = /^(cus|sub|price|prod)_/u;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalStringField(
  record: UnknownRecord,
  key: string
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapVortexStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return status;
    case "draft":
      return "incomplete";
    case "paused":
      return "past_due";
    default:
      throw new Error(`Unsupported Vortex subscription status: ${status}`);
  }
}

function parseIsoMillis(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid Vortex subscription ${label}: ${value}`);
  }
  return parsed;
}

function parseOptionalIsoMillis(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseIsoMillis(value, "timestamp");
}

function isPaidStatus(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

function isStaleSourceEvent(
  subscription: Pick<Doc<"subscriptions">, "lastSourceEventAt">,
  incomingCreatedAtMs: number | undefined
): boolean {
  return (
    incomingCreatedAtMs !== undefined &&
    subscription.lastSourceEventAt !== undefined &&
    incomingCreatedAtMs < subscription.lastSourceEventAt
  );
}

function blocksEqualMsPastDueWiden(
  subscription: Pick<Doc<"subscriptions">, "lastSourceEventAt" | "status">,
  incomingStatus: SubscriptionStatus,
  incomingCreatedAtMs: number | undefined
): boolean {
  return (
    incomingCreatedAtMs !== undefined &&
    subscription.lastSourceEventAt !== undefined &&
    incomingCreatedAtMs <= subscription.lastSourceEventAt &&
    subscription.status === "past_due" &&
    isPaidStatus(incomingStatus)
  );
}

function sourceEventPatch(incomingCreatedAtMs: number | undefined): {
  readonly lastSourceEventAt?: number;
} {
  return incomingCreatedAtMs === undefined
    ? {}
    : { lastSourceEventAt: incomingCreatedAtMs };
}

async function insertProcessedVortexEvent(
  ctx: MutationCtx,
  input: {
    readonly eventId: string;
    readonly eventType: string;
    readonly processedAt: number;
  }
): Promise<void> {
  await ctx.db.insert("vortex_billing_webhook_events", input);
}

export function parseVortexInvoiceEvent(
  event: VortexInvoiceEventInput
): VortexInvoiceProjection | null {
  if (
    event.type !== "invoice.paid" &&
    event.type !== "invoice.payment_failed"
  ) {
    return null;
  }
  if (!isRecord(event.data)) {
    return null;
  }

  const invoice = event.data.invoice;
  if (!isRecord(invoice)) {
    return null;
  }

  const invoiceNumber = stringField(invoice, "invoiceNumber");
  const invoiceStatus = stringField(invoice, "status");
  if (invoiceNumber === null || invoiceStatus === null) {
    return null;
  }

  return {
    eventId: event.id,
    eventType: event.type,
    subscriptionExternalId: optionalStringField(
      invoice,
      "subscriptionExternalId"
    ),
    invoiceNumber,
    invoiceStatus,
    sourceCreatedAt: event.createdAt,
  };
}

export function parseVortexPayableObjectEvent(
  event: VortexInvoiceEventInput
): VortexPayableObjectProjection | null {
  if (event.type !== "payable_object.updated") {
    return null;
  }
  if (!isRecord(event.data)) {
    return null;
  }

  const payableObject = event.data.payableObject;
  if (!isRecord(payableObject)) {
    return null;
  }

  const payableId = stringField(payableObject, "payableId");
  const status = stringField(payableObject, "status");
  if (
    payableId === null ||
    (status !== "paid" && status !== "failed" && status !== "awaiting_payment")
  ) {
    return null;
  }

  const lineage = isRecord(payableObject.lineage) ? payableObject.lineage : {};

  return {
    eventId: event.id,
    payableId,
    status,
    paymentRequestId: optionalStringField(lineage, "paymentRequestId"),
    hostedInvoiceUrl: optionalStringField(lineage, "checkoutUrl"),
  };
}

async function cancelOtherPaidSubscriptions(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  externalSubscriptionId: string,
  now: number
): Promise<void> {
  const activeSubscriptions: Doc<"subscriptions">[] = [];
  for await (const subscription of ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active")
    )) {
    activeSubscriptions.push(subscription);
  }
  const trialingSubscriptions: Doc<"subscriptions">[] = [];
  for await (const subscription of ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "trialing")
    )) {
    trialingSubscriptions.push(subscription);
  }

  for (const subscription of [
    ...activeSubscriptions,
    ...trialingSubscriptions,
  ]) {
    if (subscription.externalSubscriptionId === externalSubscriptionId) {
      continue;
    }
    await ctx.db.patch("subscriptions", subscription._id, {
      status: "canceled",
      canceledAt: now,
      cancelReason: "replaced_by_vortex_billing_subscription",
      updatedAt: now,
    });
  }
}

async function hasActiveNonVortexProviderShapedSubscription(
  ctx: MutationCtx,
  organizationId: Id<"organizations">
): Promise<boolean> {
  for await (const subscription of ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active")
    )) {
    if (
      nonVortexProviderIdPattern.test(subscription.externalCustomerId) ||
      nonVortexProviderIdPattern.test(subscription.externalSubscriptionId) ||
      nonVortexProviderIdPattern.test(subscription.externalPriceId)
    ) {
      return true;
    }
  }

  return false;
}

export const projectSubscriptionUpdated = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.literal("subscription.updated"),
    sealOrganizationId: v.id("organizations"),
    subscriptionExternalId: v.string(),
    customerExternalId: v.string(),
    planCode: v.string(),
    status: v.string(),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.string(),
    currentPeriodEnd: v.string(),
    canceledAt: v.optional(v.string()),
    cancelReason: v.optional(v.string()),
    latestInvoiceId: v.optional(v.string()),
    sourceCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VortexSubscriptionProjectionResult> => {
    const existingEvent = await ctx.db
      .query("vortex_billing_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existingEvent) {
      return {
        processed: false,
        duplicate: true,
        organizationId: args.sealOrganizationId,
        externalSubscriptionId: args.subscriptionExternalId,
        activeNonVortexProviderIdPresent:
          await hasActiveNonVortexProviderShapedSubscription(
            ctx,
            args.sealOrganizationId
          ),
      };
    }

    const organization = await ctx.db.get(
      "organizations",
      args.sealOrganizationId
    );
    if (!organization) {
      throw new Error(
        `Seal organization not found for Vortex webhook: ${args.sealOrganizationId}`
      );
    }

    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.subscriptionExternalId)
      )
      .first();
    const status = mapVortexStatus(args.status);
    const now = Date.now();

    if (
      existingSubscription &&
      (isStaleSourceEvent(existingSubscription, args.sourceCreatedAt) ||
        blocksEqualMsPastDueWiden(
          existingSubscription,
          status,
          args.sourceCreatedAt
        ))
    ) {
      await insertProcessedVortexEvent(ctx, {
        eventId: args.eventId,
        eventType: args.eventType,
        processedAt: now,
      });
      return {
        processed: false,
        duplicate: false,
        ignored: true,
        organizationId: args.sealOrganizationId,
        externalSubscriptionId: args.subscriptionExternalId,
        activeNonVortexProviderIdPresent:
          await hasActiveNonVortexProviderShapedSubscription(
            ctx,
            args.sealOrganizationId
          ),
      };
    }

    const price = await resolveSubscriptionPriceByAnyId(ctx.db, args.planCode);
    if (!price) {
      throw new Error(
        `Seal subscription price not found for Vortex planCode: ${args.planCode}. Run Vortex catalog sync before projecting this subscription.`
      );
    }

    const projection = {
      organizationId: args.sealOrganizationId,
      externalCustomerId: args.customerExternalId,
      externalSubscriptionId: args.subscriptionExternalId,
      externalPriceId: args.planCode,
      status,
      currentPeriodStart: parseIsoMillis(
        args.currentPeriodStart,
        "currentPeriodStart"
      ),
      currentPeriodEnd: parseIsoMillis(
        args.currentPeriodEnd,
        "currentPeriodEnd"
      ),
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      canceledAt: parseOptionalIsoMillis(args.canceledAt),
      cancelReason: args.cancelReason,
      latestInvoiceId: args.latestInvoiceId,
      ...sourceEventPatch(args.sourceCreatedAt),
      updatedAt: now,
    };

    if (existingSubscription) {
      await ctx.db.patch("subscriptions", existingSubscription._id, projection);
      if (isPaidStatus(status)) {
        await cancelOtherPaidSubscriptions(
          ctx,
          args.sealOrganizationId,
          args.subscriptionExternalId,
          now
        );
      } else if (
        isPaidStatus(existingSubscription.status) &&
        existingSubscription.organizationId
      ) {
        await ctx.scheduler.runAfter(
          0,
          internal.webhooks.delivery.abandonPendingDeliveriesForOrg,
          {
            organizationId: existingSubscription.organizationId,
          }
        );
      }
    } else {
      await ctx.db.insert("subscriptions", {
        ...projection,
        createdAt: now,
      });
      if (isPaidStatus(status)) {
        await cancelOtherPaidSubscriptions(
          ctx,
          args.sealOrganizationId,
          args.subscriptionExternalId,
          now
        );
      }
    }

    await insertProcessedVortexEvent(ctx, {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: now,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.vortex_billing.worker_subscriptions.projectSubscriptionUpdated,
      {
        eventId: args.eventId,
        organizationId: args.sealOrganizationId,
        externalCustomerId: args.customerExternalId,
        externalSubscriptionId: args.subscriptionExternalId,
        externalPriceId: args.planCode,
        externalProductId: price.externalProductId,
        status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodStart: parseIsoMillis(
          args.currentPeriodStart,
          "currentPeriodStart"
        ),
        currentPeriodEnd: parseIsoMillis(
          args.currentPeriodEnd,
          "currentPeriodEnd"
        ),
        canceledAt: parseOptionalIsoMillis(args.canceledAt),
        cancelReason: args.cancelReason,
        latestInvoiceId: args.latestInvoiceId,
      }
    );

    return {
      processed: true,
      duplicate: false,
      organizationId: args.sealOrganizationId,
      externalSubscriptionId: args.subscriptionExternalId,
      activeNonVortexProviderIdPresent:
        await hasActiveNonVortexProviderShapedSubscription(
          ctx,
          args.sealOrganizationId
        ),
    };
  },
});

function invoiceResult(input: {
  readonly processed: boolean;
  readonly duplicate: boolean;
  readonly ignored: boolean;
  readonly externalSubscriptionId?: string;
}): VortexInvoiceProjectionResult {
  return input.externalSubscriptionId === undefined
    ? {
        processed: input.processed,
        duplicate: input.duplicate,
        ignored: input.ignored,
      }
    : {
        processed: input.processed,
        duplicate: input.duplicate,
        ignored: input.ignored,
        externalSubscriptionId: input.externalSubscriptionId,
      };
}

async function projectInvoiceEvent(
  ctx: MutationCtx,
  args: VortexInvoiceProjection,
  statusPatch: {
    readonly status?: SubscriptionStatus;
    readonly latestInvoiceStatus: string;
  }
): Promise<VortexInvoiceProjectionResult> {
  const existingEvent = await ctx.db
    .query("vortex_billing_webhook_events")
    .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
    .first();
  if (existingEvent) {
    return invoiceResult({
      processed: false,
      duplicate: true,
      ignored: false,
      externalSubscriptionId: args.subscriptionExternalId,
    });
  }

  const subscriptionExternalId = args.subscriptionExternalId;
  if (subscriptionExternalId === undefined) {
    return invoiceResult({
      processed: false,
      duplicate: false,
      ignored: true,
    });
  }

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_external_subscription_id", (q) =>
      q.eq("externalSubscriptionId", subscriptionExternalId)
    )
    .first();
  if (!subscription) {
    return invoiceResult({
      processed: false,
      duplicate: false,
      ignored: true,
      externalSubscriptionId: subscriptionExternalId,
    });
  }

  const now = Date.now();
  if (isStaleSourceEvent(subscription, args.sourceCreatedAt)) {
    await insertProcessedVortexEvent(ctx, {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: now,
    });
    return invoiceResult({
      processed: false,
      duplicate: false,
      ignored: true,
      externalSubscriptionId: subscriptionExternalId,
    });
  }

  const entitlementPatch =
    statusPatch.status === "past_due"
      ? {
          pastDueSince:
            subscription.status === "past_due"
              ? subscription.pastDueSince
              : now,
        }
      : args.eventType === "invoice.paid" && subscription.status === "past_due"
        ? {
            status: "active" as const,
            pastDueSince: undefined,
          }
        : {};

  await ctx.db.patch("subscriptions", subscription._id, {
    ...statusPatch,
    ...entitlementPatch,
    latestInvoiceId: args.invoiceNumber,
    ...sourceEventPatch(args.sourceCreatedAt),
    updatedAt: now,
  });

  await insertProcessedVortexEvent(ctx, {
    eventId: args.eventId,
    eventType: args.eventType,
    processedAt: now,
  });

  const finalStatus =
    ("status" in entitlementPatch ? entitlementPatch.status : undefined) ??
    statusPatch.status ??
    subscription.status;

  await ctx.scheduler.runAfter(
    0,
    internal.vortex_billing.worker_subscriptions.projectInvoiceEvent,
    {
      eventId: args.eventId,
      organizationId: subscription.organizationId,
      externalCustomerId: subscription.externalCustomerId,
      externalSubscriptionId: subscription.externalSubscriptionId,
      externalPriceId: subscription.externalPriceId,
      externalProductId: subscription.externalProductId,
      invoiceNumber: args.invoiceNumber,
      invoiceStatus: args.invoiceStatus,
      status: finalStatus,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      latestInvoiceStatus: statusPatch.latestInvoiceStatus,
    }
  );

  const invoiceUpdatePayload = JSON.stringify({
    id: args.invoiceNumber,
    status: statusPatch.latestInvoiceStatus,
    paidAt: statusPatch.latestInvoiceStatus === "paid" ? now : undefined,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.payment_fields.worker_invoices.updateDocumentInvoice,
    { payload: invoiceUpdatePayload }
  );

  return invoiceResult({
    processed: true,
    duplicate: false,
    ignored: false,
    externalSubscriptionId: subscriptionExternalId,
  });
}

export const projectInvoicePaid = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.literal("invoice.paid"),
    subscriptionExternalId: v.optional(v.string()),
    invoiceNumber: v.string(),
    invoiceStatus: v.string(),
    sourceCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VortexInvoiceProjectionResult> => {
    return await projectInvoiceEvent(ctx, args, {
      latestInvoiceStatus: "paid",
    });
  },
});

export const projectInvoicePaymentFailed = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.literal("invoice.payment_failed"),
    subscriptionExternalId: v.optional(v.string()),
    invoiceNumber: v.string(),
    invoiceStatus: v.string(),
    sourceCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VortexInvoiceProjectionResult> => {
    return await projectInvoiceEvent(ctx, args, {
      status: "past_due",
      latestInvoiceStatus: args.invoiceStatus,
    });
  },
});
