import { describe, expect, test } from "vitest";

import { createVortexWebhookSignature, verifyVortexWebhookSignature } from "../webhook_signature";

describe("Vortex Billing webhook signatures", () => {
  const secret = "whsec_vortex_test";
  const payload = JSON.stringify({
    id: "evt_test",
    type: "subscription.updated",
    data: { subscription: { subscriptionExternalId: "vtx_sub_test" } },
  });
  const timestamp = 1_767_000_000_000;

  test("accepts a valid Vortex signature header", async () => {
    const signed = await createVortexWebhookSignature({ payload, secret, timestamp });

    const result = await verifyVortexWebhookSignature({
      payload,
      header: signed.header,
      secret,
      now: timestamp,
    });

    expect(result).toMatchObject({ ok: true, timestamp, signature: signed.signature });
  });

  test("rejects tampered payloads", async () => {
    const signed = await createVortexWebhookSignature({ payload, secret, timestamp });

    const result = await verifyVortexWebhookSignature({
      payload: `${payload} `,
      header: signed.header,
      secret,
      now: timestamp,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  test("rejects stale signatures", async () => {
    const signed = await createVortexWebhookSignature({ payload, secret, timestamp });

    const result = await verifyVortexWebhookSignature({
      payload,
      header: signed.header,
      secret,
      now: timestamp + 301_000,
    });

    expect(result).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
  });
});
