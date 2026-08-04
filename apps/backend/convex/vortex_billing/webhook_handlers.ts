import type { GenericActionCtx } from "convex/server";

import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import {
  parseVortexInvoiceEvent,
  parseVortexPayableObjectEvent,
} from "./projection";
import { verifyVortexWebhookSignature } from "./webhook_signature";

type HttpActionCtx = GenericActionCtx<DataModel>;
type UnknownRecord = Readonly<Record<string, unknown>>;

export type VortexSubscriptionUpdatedProjection = {
  readonly eventId: string;
  readonly eventType: "subscription.updated";
  readonly sealOrganizationId: Id<"organizations">;
  readonly subscriptionExternalId: string;
  readonly customerExternalId: string;
  readonly planCode: string;
  readonly status: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly canceledAt?: string;
  readonly cancelReason?: string;
  readonly latestInvoiceId?: string;
  readonly sourceCreatedAt?: number;
};

export type VortexWebhookEnvelope = UnknownRecord & {
  readonly id: string;
  readonly type: string;
  readonly apiVersion?: string;
  readonly environment?: "sandbox" | "production";
  readonly createdAt?: number;
  readonly data?: unknown;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

function booleanField(record: UnknownRecord, key: string): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function parseVortexWebhookEnvelope(
  payload: string
): VortexWebhookEnvelope | null {
  const parsed = JSON.parse(payload) as unknown;
  if (!isRecord(parsed)) {
    return null;
  }

  const id = parsed.id;
  const type = parsed.type;
  const apiVersion = parsed.apiVersion;
  const environment = parsed.environment;
  const createdAt = parsed.createdAt;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof type !== "string" ||
    type.length === 0
  ) {
    return null;
  }
  if (apiVersion !== undefined && typeof apiVersion !== "string") {
    return null;
  }
  if (
    environment !== undefined &&
    environment !== "sandbox" &&
    environment !== "production"
  ) {
    return null;
  }
  if (createdAt !== undefined && typeof createdAt !== "number") {
    return null;
  }

  return parsed as VortexWebhookEnvelope;
}

export function parseVortexSubscriptionUpdatedProjection(
  event: VortexWebhookEnvelope
): VortexSubscriptionUpdatedProjection | null {
  if (event.type !== "subscription.updated" || !isRecord(event.data)) {
    return null;
  }

  const subscription = event.data.subscription;
  if (!isRecord(subscription)) {
    return null;
  }

  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const sealOrganizationId =
    stringField(metadata, "sealOrganizationId") ??
    stringField(subscription, "sealOrganizationId");
  const subscriptionExternalId = stringField(
    subscription,
    "subscriptionExternalId"
  );
  const customerExternalId = stringField(subscription, "customerExternalId");
  const planCode = stringField(subscription, "planCode");
  const status = stringField(subscription, "status");
  const cancelAtPeriodEnd = booleanField(subscription, "cancelAtPeriodEnd");
  const currentPeriodStart = stringField(subscription, "currentPeriodStart");
  const currentPeriodEnd = stringField(subscription, "currentPeriodEnd");

  if (
    sealOrganizationId === null ||
    subscriptionExternalId === null ||
    customerExternalId === null ||
    planCode === null ||
    status === null ||
    cancelAtPeriodEnd === null ||
    currentPeriodStart === null ||
    currentPeriodEnd === null
  ) {
    return null;
  }

  return {
    eventId: event.id,
    eventType: "subscription.updated",
    sealOrganizationId: sealOrganizationId as Id<"organizations">,
    subscriptionExternalId,
    customerExternalId,
    planCode,
    status,
    cancelAtPeriodEnd,
    currentPeriodStart,
    currentPeriodEnd,
    canceledAt: optionalStringField(subscription, "canceledAt"),
    cancelReason:
      optionalStringField(subscription, "cancelReason") ??
      optionalStringField(subscription, "cancellationReason"),
    latestInvoiceId: optionalStringField(subscription, "latestInvoiceId"),
    sourceCreatedAt: event.createdAt,
  };
}

type VortexWebhookDispatchType =
  | "subscription.updated"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "payable_object.updated";

type VortexWebhookDispatcher = (
  ctx: HttpActionCtx,
  event: VortexWebhookEnvelope
) => Promise<Response>;

function isVortexWebhookDispatchType(
  type: string
): type is VortexWebhookDispatchType {
  return (
    type === "subscription.updated" ||
    type === "invoice.paid" ||
    type === "invoice.payment_failed" ||
    type === "payable_object.updated"
  );
}

const vortexWebhookDispatchers: Record<
  VortexWebhookDispatchType,
  VortexWebhookDispatcher
> = {
  "subscription.updated": async (ctx, event): Promise<Response> => {
    const projection = parseVortexSubscriptionUpdatedProjection(event);
    if (projection === null) {
      return jsonResponse(
        { error: "invalid_subscription_payload", eventId: event.id },
        400
      );
    }

    const result = await ctx.runMutation(
      internal.vortex_billing.projection.projectSubscriptionUpdated,
      projection
    );
    return jsonResponse({ received: true, eventId: event.id, ...result }, 200);
  },
  "invoice.paid": async (ctx, event): Promise<Response> => {
    const projection = parseVortexInvoiceEvent(event);
    if (projection === null) {
      return jsonResponse(
        { error: "invalid_invoice_payload", eventId: event.id },
        400
      );
    }
    if (projection.eventType !== "invoice.paid") {
      return jsonResponse(
        { error: "invalid_invoice_payload", eventId: event.id },
        400
      );
    }

    const result = await ctx.runMutation(
      internal.vortex_billing.projection.projectInvoicePaid,
      {
        ...projection,
        eventType: "invoice.paid",
      }
    );
    return jsonResponse({ received: true, eventId: event.id, ...result }, 200);
  },
  "invoice.payment_failed": async (ctx, event): Promise<Response> => {
    const projection = parseVortexInvoiceEvent(event);
    if (projection === null) {
      return jsonResponse(
        { error: "invalid_invoice_payload", eventId: event.id },
        400
      );
    }
    if (projection.eventType !== "invoice.payment_failed") {
      return jsonResponse(
        { error: "invalid_invoice_payload", eventId: event.id },
        400
      );
    }

    const result = await ctx.runMutation(
      internal.vortex_billing.projection.projectInvoicePaymentFailed,
      {
        ...projection,
        eventType: "invoice.payment_failed",
      }
    );
    return jsonResponse({ received: true, eventId: event.id, ...result }, 200);
  },
  "payable_object.updated": async (ctx, event): Promise<Response> => {
    const projection = parseVortexPayableObjectEvent(event);
    if (projection === null) {
      return jsonResponse(
        { error: "invalid_payable_object_payload", eventId: event.id },
        400
      );
    }

    const result = await ctx.runMutation(
      internal.vortex_billing.projection.projectPayableObjectUpdated,
      projection
    );
    return jsonResponse({ received: true, eventId: event.id, ...result }, 200);
  },
};

export async function handleVortexBillingWebhookRequest(
  ctx: HttpActionCtx,
  request: Request,
  secret: string
): Promise<Response> {
  const payload = await request.text();
  const signature = await verifyVortexWebhookSignature({
    payload,
    header: request.headers.get("Vortex-Signature"),
    secret,
  });

  if (!signature.ok) {
    return jsonResponse(
      { error: "invalid_signature", reason: signature.reason },
      400
    );
  }

  let event: VortexWebhookEnvelope | null;
  try {
    event = parseVortexWebhookEnvelope(payload);
  } catch {
    event = null;
  }
  if (event === null) {
    return jsonResponse({ error: "invalid_payload" }, 400);
  }

  if (!isVortexWebhookDispatchType(event.type)) {
    return jsonResponse(
      { received: true, eventId: event.id, ignored: true },
      200
    );
  }

  return await vortexWebhookDispatchers[event.type](ctx, event);
}
