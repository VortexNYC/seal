import { describe, expect, test } from "vitest";

import {
  createVortexWebhookSignature,
  extractVortexPayableUpdatedProjection,
  extractVortexSubscriptionProjection,
  parseVortexBillingWebhookEvent,
  verifyVortexWebhookSignature,
} from "./webhook_receiver";

const secret = "whsec_vortex_receiver_test";
const timestamp = Date.UTC(2026, 0, 1);

function payablePayload() {
  return JSON.stringify({
    id: "evt_payable_1",
    type: "payable_object.updated",
    data: {
      payableObject: {
        payableId: "payable_123",
        status: "paid",
        lineage: {
          paymentRequestId: "pr_123",
          checkoutUrl: "https://billing.vortex.test/pay/123",
        },
      },
    },
  });
}

function subscriptionPayload() {
  return JSON.stringify({
    id: "evt_subscription_1",
    type: "subscription.updated",
    data: {
      subscription: {
        subscriptionExternalId: "vtx_sub_seal_123",
        customerExternalId: "vtx_cust_seal_123",
        planCode: "vtx_price_seal_pro_monthly",
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodStart: "2026-01-01T00:00:00.000Z",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z",
        metadata: {
          sealOrganizationId: "org_123",
        },
      },
    },
  });
}

describe("Vortex Billing webhook receiver", () => {
  test("verifies Vortex-Signature headers", async () => {
    const payload = payablePayload();
    const signed = await createVortexWebhookSignature({ payload, secret, timestamp });

    await expect(
      verifyVortexWebhookSignature({
        payload,
        header: signed.header,
        secret,
        now: timestamp,
      }),
    ).resolves.toMatchObject({ ok: true, timestamp });
  });

  test("rejects missing, invalid, stale, and wrong-secret signatures", async () => {
    const payload = payablePayload();
    const signed = await createVortexWebhookSignature({ payload, secret, timestamp });

    await expect(
      verifyVortexWebhookSignature({ payload, header: null, secret, now: timestamp }),
    ).resolves.toEqual({ ok: false, reason: "missing_header" });
    await expect(
      verifyVortexWebhookSignature({ payload, header: "bad", secret, now: timestamp }),
    ).resolves.toEqual({ ok: false, reason: "invalid_header" });
    await expect(
      verifyVortexWebhookSignature({
        payload,
        header: signed.header,
        secret,
        now: timestamp + 301_000,
      }),
    ).resolves.toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
    await expect(
      verifyVortexWebhookSignature({
        payload,
        header: signed.header,
        secret: "wrong",
        now: timestamp,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_signature" });
  });

  test("extracts payable_object.updated projection arguments", () => {
    const event = parseVortexBillingWebhookEvent(payablePayload());
    expect(event).not.toBeNull();
    const projection = extractVortexPayableUpdatedProjection(event!);

    expect(projection).toEqual({
      vortexPayableId: "payable_123",
      vortexStatus: "paid",
      vortexPaymentRequestId: "pr_123",
      hostedInvoiceUrl: "https://billing.vortex.test/pay/123",
    });
  });

  test("rejects malformed payable_object.updated payloads", () => {
    const event = parseVortexBillingWebhookEvent(
      JSON.stringify({
        id: "evt_payable_bad",
        type: "payable_object.updated",
        data: { payableObject: { payableId: "payable_123" } },
      }),
    );

    expect(event).not.toBeNull();
    expect(extractVortexPayableUpdatedProjection(event!)).toBeNull();
    expect(parseVortexBillingWebhookEvent("{")).toBeNull();
  });

  test("extracts subscription.updated projection arguments", () => {
    const event = parseVortexBillingWebhookEvent(subscriptionPayload());
    expect(event).not.toBeNull();
    const projection = extractVortexSubscriptionProjection(event!);

    expect(projection).toEqual({
      vortexSubscriptionId: "vtx_sub_seal_123",
      vortexCustomerId: "vtx_cust_seal_123",
      vortexPriceId: "vtx_price_seal_pro_monthly",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: Date.UTC(2026, 0, 1),
      currentPeriodEnd: Date.UTC(2026, 1, 1),
      sealOrganizationId: "org_123",
      latestInvoiceId: undefined,
      canceledAt: undefined,
      cancelReason: undefined,
    });
  });

  test("rejects malformed subscription.updated payloads", () => {
    const event = parseVortexBillingWebhookEvent(
      JSON.stringify({
        id: "evt_subscription_bad",
        type: "subscription.updated",
        data: {
          subscription: {
            subscriptionExternalId: "vtx_sub_seal_123",
            customerExternalId: "vtx_cust_seal_123",
            status: "active",
          },
        },
      }),
    );

    expect(event).not.toBeNull();
    expect(extractVortexSubscriptionProjection(event!)).toBeNull();
  });
});
