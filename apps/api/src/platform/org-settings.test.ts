import { describe, expect, it } from "vitest";

import {
  applyWebhookPayloadMode,
  defaultSealSettings,
  getSealSettings,
} from "./org-settings.js";

describe("org-settings (SEA-70)", () => {
  it("defaults egress gates to open / full payloads", () => {
    const settings = getSealSettings(null);
    expect(settings).toEqual(defaultSealSettings);
    expect(settings.egress.webhook_payload_mode).toBe("full");
    expect(settings.egress.allow_convert).toBe(true);
    expect(settings.ai.enabled).toBe(true);
  });

  it("merges egress overrides from seal_settings metadata", () => {
    const settings = getSealSettings(
      JSON.stringify({
        seal_settings: {
          ai: { enabled: false },
          egress: {
            webhook_payload_mode: "minimal",
            allow_convert: false,
          },
        },
      })
    );
    expect(settings.ai.enabled).toBe(false);
    expect(settings.egress.webhook_payload_mode).toBe("minimal");
    expect(settings.egress.allow_convert).toBe(false);
    expect(settings.signing.default_deadline_days).toBe(30);
  });

  it("redacts PII keys in minimal webhook mode", () => {
    const full = applyWebhookPayloadMode("full", {
      documentId: "doc_1",
      recipientId: "rec_1",
      status: "signed",
      email: "signer@example.com",
      name: "Ada Lovelace",
      title: "NDA",
      ipAddress: "198.51.100.9",
      signatureData: "data:image/png;base64,aaa",
    });
    expect(full.email).toBe("signer@example.com");
    expect(full.title).toBe("NDA");

    const minimal = applyWebhookPayloadMode("minimal", {
      documentId: "doc_1",
      recipientId: "rec_1",
      status: "signed",
      email: "signer@example.com",
      name: "Ada Lovelace",
      title: "NDA",
      ipAddress: "198.51.100.9",
      signatureData: "data:image/png;base64,aaa",
      signedAt: "2026-09-25T12:00:00.000Z",
      nested: { email: "x@y.z", documentId: "should-drop-parent" },
    });
    expect(minimal).toEqual({
      documentId: "doc_1",
      recipientId: "rec_1",
      status: "signed",
      signedAt: "2026-09-25T12:00:00.000Z",
    });
  });

  it("redacts nested objects under allowed keys", () => {
    const minimal = applyWebhookPayloadMode("minimal", {
      documentId: "doc_1",
      recipients: [
        {
          recipientId: "rec_1",
          email: "a@b.c",
          name: "A",
          status: "signed",
        },
      ],
    });
    expect(minimal).toEqual({
      documentId: "doc_1",
      recipients: [{ recipientId: "rec_1", status: "signed" }],
    });
  });
});
