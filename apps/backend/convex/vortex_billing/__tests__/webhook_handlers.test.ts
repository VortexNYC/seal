import { describe, expect, test } from "vitest";

import { parseVortexInvoiceEvent } from "../projection";
import {
  type VortexWebhookEnvelope,
  handleVortexBillingWebhookRequest,
  parseVortexSubscriptionUpdatedProjection,
} from "../webhook_handlers";
import { createVortexWebhookSignature } from "../webhook_signature";

type WebhookHandlerCtx = Parameters<
  typeof handleVortexBillingWebhookRequest
>[0];

/**
 * The webhook handler only touches `runMutation`; the unit fake covers that
 * surface. Runtime-checked structural narrowing keeps the seam cast-free.
 */
function isWebhookHandlerCtx(value: unknown): value is WebhookHandlerCtx {
  return (
    typeof value === "object" &&
    value !== null &&
    "runMutation" in value &&
    typeof value.runMutation === "function"
  );
}

function toTestWebhookCtx(value: unknown): WebhookHandlerCtx {
  if (!isWebhookHandlerCtx(value)) {
    throw new Error("Expected a runMutation-capable test ctx");
  }
  return value;
}

describe("Vortex Billing webhook payload parsing", () => {
  test("extracts the hosted checkout subscription projection contract", () => {
    const event: VortexWebhookEnvelope = {
      id: "evt_vortex_subscription",
      type: "subscription.updated",
      apiVersion: "2026-06-01",
      environment: "sandbox",
      createdAt: Date.now(),
      data: {
        subscription: {
          subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
          customerExternalId: "vtx_cust_seal_org_123",
          planCode: "vtx_price_pro_monthly",
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodStart: "2026-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
          activationReason: "checkout_payment_succeeded",
          paymentRequestId: "preq_123",
          metadata: {
            sourceSystem: "seal",
            sealOrganizationId: "org_123",
            lookupKey: "pro:business:month:v1",
          },
        },
      },
    };

    expect(parseVortexSubscriptionUpdatedProjection(event)).toMatchObject({
      eventId: "evt_vortex_subscription",
      eventType: "subscription.updated",
      sealOrganizationId: "org_123",
      subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
      customerExternalId: "vtx_cust_seal_org_123",
      planCode: "vtx_price_pro_monthly",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: "2026-01-01T00:00:00.000Z",
      currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    });
  });

  test("extracts invoice.paid invoice projection payloads", () => {
    const event: VortexWebhookEnvelope = {
      id: "evt_vortex_invoice_paid",
      type: "invoice.paid",
      apiVersion: "2026-06-01",
      environment: "sandbox",
      createdAt: 1_767_000_000_000,
      data: {
        invoice: {
          invoiceNumber: "inv_vortex_paid_001",
          subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
          status: "paid",
        },
      },
    };

    expect(parseVortexInvoiceEvent(event)).toEqual({
      eventId: "evt_vortex_invoice_paid",
      eventType: "invoice.paid",
      subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
      invoiceNumber: "inv_vortex_paid_001",
      invoiceStatus: "paid",
      sourceCreatedAt: 1_767_000_000_000,
    });
  });

  test("keeps unrelated invoice types 200-ignored without dispatching a mutation", async () => {
    const secret = "whsec_vortex_test";
    const payload = JSON.stringify({
      id: "evt_vortex_invoice_finalized",
      type: "invoice.finalized",
      apiVersion: "2026-06-01",
      environment: "sandbox",
      createdAt: 1_767_000_000_000,
      data: {
        invoice: {
          invoiceNumber: "inv_vortex_finalized_001",
          subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
          status: "open",
        },
      },
    });
    const signed = await createVortexWebhookSignature({ payload, secret });
    const request = new Request("https://seal.test/webhooks/vortex-billing", {
      method: "POST",
      headers: { "Vortex-Signature": signed.header },
      body: payload,
    });
    const ctx = toTestWebhookCtx({
      runMutation: async (): Promise<never> => {
        throw new Error(
          "unexpected mutation dispatch for ignored invoice type"
        );
      },
    });

    const response = await handleVortexBillingWebhookRequest(
      ctx,
      request,
      secret
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      eventId: "evt_vortex_invoice_finalized",
      ignored: true,
    });
  });
});
