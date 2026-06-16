import { describe, expect, test } from "vitest";
import { createPayoutsHttpHandlers } from "./payouts";
import type { PayoutsService } from "../../application/payouts/service";

function createService(): PayoutsService {
  return {
    async listMerchantPayouts() {
      return {
        items: [{
          id: "po_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          amount: 900,
          currency: "USD",
          direction: "credit",
          status: "succeeded",
          createdAt: "2026-05-14T13:00:00.000Z",
          updatedAt: "2026-05-14T14:00:00.000Z",
        }],
        hasMore: false,
      };
    },
    async getMerchantPayout() {
      return {
        id: "po_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 900,
        currency: "USD",
        direction: "credit",
        status: "succeeded",
        createdAt: "2026-05-14T13:00:00.000Z",
        updatedAt: "2026-05-14T14:00:00.000Z",
      };
    },
    async getMerchantSellerPayoutProfile() {
      return null;
    },
    async getSettlementPayoutReadiness() {
      return null;
    },
    async getSettlementFundingTimeline() {
      return null;
    },
  };
}

describe("createPayoutsHttpHandlers", () => {
  test("returns success response for payout list", async () => {
    const handlers = createPayoutsHttpHandlers({
      service: createService(),
      createRequestId: () => "req_payouts",
    });

    const response = await handlers.listMerchantPayouts({
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
            id: "po_123",
            environment: "sandbox",
            merchantAccountId: "merchant_123",
            amount: 900,
	            currency: "USD",
	            direction: "credit",
	            status: "succeeded",
	            createdAt: "2026-05-14T13:00:00.000Z",
            updatedAt: "2026-05-14T14:00:00.000Z",
          }],
          hasMore: false,
        },
        requestId: "req_payouts",
      },
    });
  });

  test("returns success response for payout detail", async () => {
    const handlers = createPayoutsHttpHandlers({
      service: createService(),
      createRequestId: () => "req_payout",
    });

    const response = await handlers.getMerchantPayout({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        payoutId: "po_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          id: "po_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          amount: 900,
	          currency: "USD",
	          direction: "credit",
	          status: "succeeded",
	          createdAt: "2026-05-14T13:00:00.000Z",
          updatedAt: "2026-05-14T14:00:00.000Z",
        },
        requestId: "req_payout",
      },
    });
  });
});
