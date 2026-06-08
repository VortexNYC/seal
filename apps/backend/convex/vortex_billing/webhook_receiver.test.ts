import { describe, expect, test } from "vitest";

import {
  createVortexWebhookSignature,
  extractVortexPayableUpdatedProjection,
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
});
