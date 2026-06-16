import { describe, expect, test } from "vitest";
import { createSettlementsHttpHandlers } from "./settlements";
import type { SettlementsService } from "../../application/settlements/service";

function createService(): SettlementsService {
  return {
    async listMerchantSettlements() {
      return {
        items: [{
          id: "st_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          currency: "USD",
          status: "closed",
          grossAmount: 1000,
          feeAmount: 100,
          refundAmount: 0,
          adjustmentAmount: 0,
          netAmount: 900,
          direction: "credit",
          closedAt: "2026-05-14T14:00:00.000Z",
          createdAt: "2026-05-14T13:00:00.000Z",
          updatedAt: "2026-05-14T14:00:00.000Z",
        }],
        hasMore: false,
      };
    },
    async getMerchantSettlement() {
      return {
        id: "st_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        currency: "USD",
        status: "closed",
        grossAmount: 1000,
        feeAmount: 100,
        refundAmount: 0,
        adjustmentAmount: 0,
        netAmount: 900,
        direction: "credit",
        closedAt: "2026-05-14T14:00:00.000Z",
        createdAt: "2026-05-14T13:00:00.000Z",
        updatedAt: "2026-05-14T14:00:00.000Z",
      };
    },
  };
}

describe("createSettlementsHttpHandlers", () => {
  test("returns success response for settlement list", async () => {
    const handlers = createSettlementsHttpHandlers({
      service: createService(),
      createRequestId: () => "req_settlements",
    });

    const response = await handlers.listMerchantSettlements({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          items: [{
            id: "st_123",
            environment: "sandbox",
            merchantAccountId: "merchant_123",
            currency: "USD",
            status: "closed",
            grossAmount: 1000,
            feeAmount: 100,
            refundAmount: 0,
            adjustmentAmount: 0,
	            netAmount: 900,
	            direction: "credit",
	            closedAt: "2026-05-14T14:00:00.000Z",
	            createdAt: "2026-05-14T13:00:00.000Z",
            updatedAt: "2026-05-14T14:00:00.000Z",
          }],
          hasMore: false,
        },
        requestId: "req_settlements",
      },
    });
  });

  test("returns success response for settlement detail", async () => {
    const handlers = createSettlementsHttpHandlers({
      service: createService(),
      createRequestId: () => "req_settlement",
    });

    const response = await handlers.getMerchantSettlement({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        settlementId: "st_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          id: "st_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          currency: "USD",
          status: "closed",
          grossAmount: 1000,
          feeAmount: 100,
          refundAmount: 0,
          adjustmentAmount: 0,
	          netAmount: 900,
	          direction: "credit",
	          closedAt: "2026-05-14T14:00:00.000Z",
	          createdAt: "2026-05-14T13:00:00.000Z",
          updatedAt: "2026-05-14T14:00:00.000Z",
        },
        requestId: "req_settlement",
      },
    });
  });
});
