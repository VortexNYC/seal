import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { updateVortexPaymentStatusFromWebhookInDb } from "../payment_fields/mutations";
import type { SubscriptionStatus } from "../schemas/subscriptions";
import { resolveSubscriptionPriceByAnyId } from "../subscription_price_resolver";
import { publishWebhookEvent } from "../webhooks/publish";

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

export type VortexPayableObjectProjectionResult = {
  readonly processed: boolean;
  readonly duplicate: boolean;
  readonly ignored: boolean;
  readonly payableId: string;
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
  const activeSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active")
    )
    .collect();
  const trialingSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "trialing")
    )
    .collect();

  for (const subscription of [
    ...activeSubscriptions,
    ...trialingSubscriptions,
  ]) {
    if (subscription.externalSubscriptionId === externalSubscriptionId) {
      continue;
    }
    await ctx.db.patch(subscription._id, {
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
  const activeSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active")
    )
    .collect();

  return activeSubscriptions.some(
    (subscription) =>
      nonVortexProviderIdPattern.test(subscription.externalCustomerId) ||
      nonVortexProviderIdPattern.test(subscription.externalSubscriptionId) ||
      nonVortexProviderIdPattern.test(subscription.externalPriceId)
  );
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

    const organization = await ctx.db.get(args.sealOrganizationId);
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
      await ctx.db.patch(existingSubscription._id, projection);
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

  await ctx.db.patch(subscription._id, {
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

function payableResult(input: {
  readonly processed: boolean;
  readonly duplicate: boolean;
  readonly ignored: boolean;
  readonly payableId: string;
}): VortexPayableObjectProjectionResult {
  return input;
}

function paymentStatusForPayableStatus(
  status: VortexPayableObjectStatus
): "awaiting" | "paid" | "failed" {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "awaiting_payment":
      return "awaiting";
  }
}

function invoiceStatusForPayableStatus(
  status: VortexPayableObjectStatus
): "open" | "paid" | "uncollectible" {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "uncollectible";
    case "awaiting_payment":
      return "open";
  }
}

function shouldIgnoreTerminalPayableProjection(input: {
  readonly currentInvoiceStatus: string | undefined;
  readonly currentPaymentStatus: string | undefined;
  readonly incomingInvoiceStatus: "open" | "paid" | "uncollectible";
  readonly incomingPaymentStatus: "awaiting" | "paid" | "failed";
}): boolean {
  if (input.currentInvoiceStatus === "paid") {
    return input.incomingInvoiceStatus !== "paid";
  }
  if (input.currentInvoiceStatus === "void") {
    return input.incomingInvoiceStatus !== "paid";
  }
  if (input.currentInvoiceStatus === "uncollectible") {
    return (
      input.incomingInvoiceStatus === "open" ||
      input.incomingInvoiceStatus === "uncollectible"
    );
  }
  if (input.currentPaymentStatus === "paid") {
    return input.incomingPaymentStatus !== "paid";
  }
  if (input.currentPaymentStatus === "cancelled") {
    return input.incomingPaymentStatus !== "paid";
  }
  if (input.currentPaymentStatus === "failed") {
    return (
      input.incomingPaymentStatus === "awaiting" ||
      input.incomingPaymentStatus === "failed"
    );
  }
  return false;
}

async function patchPayableLineage(
  ctx: MutationCtx,
  input: {
    readonly configId: Id<"payment_field_configs"> | undefined;
    readonly invoiceRecordId: Id<"document_invoices"> | undefined;
    readonly paymentRequestId: string | undefined;
    readonly hostedInvoiceUrl: string | undefined;
    readonly now: number;
  }
): Promise<void> {
  const patch = {
    ...(input.paymentRequestId !== undefined && {
      vortexPaymentRequestId: input.paymentRequestId,
    }),
    ...(input.hostedInvoiceUrl !== undefined && {
      hostedInvoiceUrl: input.hostedInvoiceUrl,
    }),
    updatedAt: input.now,
  };

  if (
    input.paymentRequestId === undefined &&
    input.hostedInvoiceUrl === undefined
  ) {
    return;
  }

  if (input.configId !== undefined) {
    await ctx.db.patch(input.configId, patch);
  }
  if (input.invoiceRecordId !== undefined) {
    await ctx.db.patch(input.invoiceRecordId, patch);
  }
}

async function cancelInvoiceDunning(
  ctx: MutationCtx,
  invoiceRecordId: Id<"document_invoices">,
  now: number
): Promise<void> {
  const invoice = await ctx.db.get(invoiceRecordId);
  if (!invoice || invoice.dunningStatus !== "active") {
    return;
  }

  await ctx.db.patch(invoiceRecordId, {
    dunningStatus: "cancelled",
    dunningCompletedAt: now,
    nextDunningAt: undefined,
    updatedAt: now,
  });
}

async function startInvoiceDunning(
  ctx: MutationCtx,
  invoiceRecordId: Id<"document_invoices">,
  now: number
): Promise<boolean> {
  const invoice = await ctx.db.get(invoiceRecordId);
  if (!invoice) {
    return false;
  }
  if (
    invoice.dunningStatus === "active" ||
    invoice.dunningStatus === "completed" ||
    invoice.dunningStatus === "cancelled"
  ) {
    return false;
  }
  if (invoice.status !== "open" && invoice.status !== "uncollectible") {
    return false;
  }

  await ctx.db.patch(invoiceRecordId, {
    dunningStatus: "active",
    dunningStep: 0,
    dunningStartedAt: now,
    nextDunningAt: now,
    updatedAt: now,
  });
  return true;
}

async function finalizeDocumentIfPaymentComplete(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  now: number
): Promise<void> {
  const document = await ctx.db.get(documentId);
  if (!document || document.workflowStatus !== "waiting_for_payment") {
    return;
  }

  const paymentConfigs = await ctx.db
    .query("payment_field_configs")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  const allPaid = paymentConfigs.every(
    (config) =>
      config.paymentStatus === "paid" || config.paymentStatus === "cancelled"
  );

  if (!allPaid) {
    return;
  }

  await ctx.db.patch(documentId, {
    workflowStatus: "completed",
    completedAt: now,
    updatedAt: now,
  });

  await publishWebhookEvent(ctx, {
    organizationId: document.organizationId,
    eventType: "document.completed",
    data: {
      document_id: documentId,
      name: document.name,
      completed_at: new Date(now).toISOString(),
    },
  });
}

export const projectPayableObjectUpdated = internalMutation({
  args: {
    eventId: v.string(),
    payableId: v.string(),
    status: v.union(
      v.literal("paid"),
      v.literal("failed"),
      v.literal("awaiting_payment")
    ),
    paymentRequestId: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexPayableObjectProjectionResult> => {
    const existingEvent = await ctx.db
      .query("vortex_billing_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existingEvent) {
      return payableResult({
        processed: false,
        duplicate: true,
        ignored: false,
        payableId: args.payableId,
      });
    }

    const [config, invoiceRecord] = await Promise.all([
      ctx.db
        .query("payment_field_configs")
        .withIndex("by_vortex_payable", (q) =>
          q.eq("vortexPayableId", args.payableId)
        )
        .first(),
      ctx.db
        .query("document_invoices")
        .withIndex("by_vortex_payable", (q) =>
          q.eq("vortexPayableId", args.payableId)
        )
        .first(),
    ]);

    if (!config && !invoiceRecord) {
      return payableResult({
        processed: false,
        duplicate: false,
        ignored: true,
        payableId: args.payableId,
      });
    }

    const now = Date.now();
    const paymentStatus = paymentStatusForPayableStatus(args.status);
    const invoiceStatus = invoiceStatusForPayableStatus(args.status);
    if (
      shouldIgnoreTerminalPayableProjection({
        currentInvoiceStatus: invoiceRecord?.status,
        currentPaymentStatus: config?.paymentStatus,
        incomingInvoiceStatus: invoiceStatus,
        incomingPaymentStatus: paymentStatus,
      })
    ) {
      await insertProcessedVortexEvent(ctx, {
        eventId: args.eventId,
        eventType: "payable_object.updated",
        processedAt: now,
      });
      return payableResult({
        processed: false,
        duplicate: false,
        ignored: true,
        payableId: args.payableId,
      });
    }

    const result = await updateVortexPaymentStatusFromWebhookInDb(ctx, {
      vortexPayableId: args.payableId,
      paymentStatus,
    });
    if (result === null) {
      return payableResult({
        processed: false,
        duplicate: false,
        ignored: true,
        payableId: args.payableId,
      });
    }

    await patchPayableLineage(ctx, {
      configId: result.configId,
      invoiceRecordId: result.invoiceRecordId,
      paymentRequestId: args.paymentRequestId,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      now,
    });

    if (args.status === "paid") {
      if (result.invoiceRecordId !== undefined) {
        await cancelInvoiceDunning(ctx, result.invoiceRecordId, now);
      }
      if (result.documentId !== undefined) {
        await finalizeDocumentIfPaymentComplete(ctx, result.documentId, now);
      }
    } else if (
      args.status === "failed" &&
      result.invoiceRecordId !== undefined
    ) {
      // Open the dunning sequence (step 0, due now). Email delivery + step advancement are
      // driven by Seal's existing processDunningEmails cron — the canonical dunning path — so
      // the projection stays a pure state mutation and the post-webhook step is deterministic.
      await startInvoiceDunning(ctx, result.invoiceRecordId, now);
    }

    await insertProcessedVortexEvent(ctx, {
      eventId: args.eventId,
      eventType: "payable_object.updated",
      processedAt: now,
    });

    return payableResult({
      processed: true,
      duplicate: false,
      ignored: false,
      payableId: args.payableId,
    });
  },
});
