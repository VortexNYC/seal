import { describe, expect, test } from "vitest";
import type { WebhooksService } from "../../application/webhooks/service";
import { WebhooksServiceError } from "../../application/webhooks/impl";
import { createWebhooksHttpHandlers } from "./webhooks";

describe("createWebhooksHttpHandlers", () => {
  test("returns success response for accepted webhook", async () => {
    const service: WebhooksService = {
      async ingestProviderWebhook() {
        return {
          rawWebhookId: "raw_123",
          accepted: true,
          duplicate: false,
          signatureStatus: "valid",
        };
      },
    };

    const handlers = createWebhooksHttpHandlers({
      service,
      createRequestId: () => "req_123",
    });

    const response = await handlers.ingestProviderWebhook({
      body: {
        environment: "sandbox",
        provider: "finix",
        headers: {},
        rawBody: "{}",
        receivedAt: "2026-04-23T12:00:00.000Z",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          rawWebhookId: "raw_123",
          accepted: true,
          duplicate: false,
          signatureStatus: "valid",
        },
        requestId: "req_123",
      },
    });
  });

  test("maps service error to http error", async () => {
    const service: WebhooksService = {
      async ingestProviderWebhook() {
        throw new WebhooksServiceError("provider_unavailable", "provider down", {
          retryable: true,
        });
      },
    };

    const handlers = createWebhooksHttpHandlers({
      service,
      createRequestId: () => "req_456",
    });

    const response = await handlers.ingestProviderWebhook({
      body: {
        environment: "sandbox",
        provider: "finix",
        headers: {},
        rawBody: "{}",
        receivedAt: "2026-04-23T12:00:00.000Z",
      },
    });

    expect(response).toEqual({
      status: 503,
      body: {
        code: "provider_unavailable",
        category: "webhooks_service",
        message: "provider down",
        actionRequired: false,
        retryable: true,
        requestId: "req_456",
      },
    });
  });
});
