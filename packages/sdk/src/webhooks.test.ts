import { describe, expect, it } from "vitest";

import {
  parseSealWebhookEnvelope,
  verifySealWebhookSignature,
} from "./webhooks.js";

describe("verifySealWebhookSignature", () => {
  it("accepts sha256 HMAC of the raw payload", async () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({
      eventId: "evt_1",
      eventType: "document.completed",
      timestamp: "2026-01-01T00:00:00.000Z",
      data: { documentId: "doc_1" },
    });
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(
      await verifySealWebhookSignature(payload, `sha256=${hex}`, secret)
    ).toBe(true);
    expect(
      await verifySealWebhookSignature(payload, "sha256=deadbeef", secret)
    ).toBe(false);
  });
});

describe("parseSealWebhookEnvelope", () => {
  it("parses delivery JSON", () => {
    const env = parseSealWebhookEnvelope(
      JSON.stringify({
        eventId: "e1",
        eventType: "recipient.viewed",
        timestamp: "2026-01-01T00:00:00.000Z",
        payloadMode: "full",
        data: { recipientId: "r1" },
      })
    );
    expect(env.eventType).toBe("recipient.viewed");
    expect(env.data.recipientId).toBe("r1");
  });
});
