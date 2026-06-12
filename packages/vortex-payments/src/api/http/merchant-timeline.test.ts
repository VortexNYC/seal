import { describe, expect, test } from "vitest";
import type { MerchantTimelineService } from "../../application/merchant-timeline/service";
import { createMerchantTimelineHttpHandlers } from "./merchant-timeline";

describe("createMerchantTimelineHttpHandlers", () => {
  test("returns success response for merchant timeline list", async () => {
    const service: MerchantTimelineService = {
      async listMerchantTimeline() {
        return {
          items: [{
            id: "evt_123",
            eventType: "merchant_account.approved",
            aggregateType: "merchant_account",
            aggregateId: "finix_merchant_123",
            occurredAt: "2026-05-14T20:00:00.000Z",
            sourceProvider: "finix",
            description: "Merchant account can accept payments.",
            payload: { merchantAccountId: "merchant_123" },
          }],
          hasMore: false,
        };
      },
    };

    const handlers = createMerchantTimelineHttpHandlers({
      service,
      createRequestId: () => "req_timeline_123",
    });

    const response = await handlers.listMerchantTimeline({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        limit: 20,
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          items: [{
            id: "evt_123",
            eventType: "merchant_account.approved",
            aggregateType: "merchant_account",
            aggregateId: "finix_merchant_123",
            occurredAt: "2026-05-14T20:00:00.000Z",
            sourceProvider: "finix",
            description: "Merchant account can accept payments.",
            payload: { merchantAccountId: "merchant_123" },
          }],
          hasMore: false,
        },
        requestId: "req_timeline_123",
      },
    });
  });
});
