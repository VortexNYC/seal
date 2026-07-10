import { describe, expect, test } from "vitest";
import type { DisputeSnapshot } from "../../application/disputes/contracts";
import type { DisputesService } from "../../application/disputes/service";
import { createDisputesHttpHandlers } from "./disputes";

const dispute: DisputeSnapshot = {
  id: "dp_123",
  environment: "sandbox",
  merchantAccountId: "merchant_123",
  paymentId: "pay_123",
  amount: 900,
  currency: "USD",
  stage: "chargeback",
  responseState: "needs_response",
  openedAt: "2026-05-14T13:00:00.000Z",
  createdAt: "2026-05-14T13:00:00.000Z",
  updatedAt: "2026-05-14T14:00:00.000Z",
};

function createService(): DisputesService {
  return {
    async listMerchantDisputes() {
      return {
        items: [dispute],
        hasMore: false,
      };
    },
    async getMerchantDispute() {
      return dispute;
    },
    async acceptDispute() {
      return {
        dispute: { ...dispute, responseState: "accepted" },
        action: "accepted",
        actionState: "ACCEPTED",
      };
    },
    async createDisputeEvidence() {
      return {
        dispute,
        evidence: {
          state: "PENDING",
        },
      };
    },
    async getDisputeEvidence() {
      return {
        dispute,
        evidence: {
          state: "PENDING",
        },
      };
    },
    async listDisputeEvidence() {
      return {
        items: [
          {
            state: "PENDING",
            createdAt: "2026-05-14T16:00:00.000Z",
            updatedAt: "2026-05-14T16:00:00.000Z",
          },
        ],
        hasMore: false,
      };
    },
    async submitDisputeEvidence() {
      return {
        dispute: { ...dispute, responseState: "responded", evidenceStatus: "submitted" },
        evidence: {
          state: "SUBMITTED",
        },
      };
    },
    async listDisputeAdjustmentTransfers() {
      return {
        items: [
          {
            amount: 900,
            currency: "USD",
          },
        ],
        hasMore: false,
      };
    },
  };
}

describe("createDisputesHttpHandlers", () => {
  test("returns success response for dispute list", async () => {
    const handlers = createDisputesHttpHandlers({
      service: createService(),
      createRequestId: () => "req_disputes",
    });

    const response = await handlers.listMerchantDisputes({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          items: [dispute],
          hasMore: false,
        },
        requestId: "req_disputes",
      },
    });
  });

  test("returns success response for dispute detail", async () => {
    const handlers = createDisputesHttpHandlers({
      service: createService(),
      createRequestId: () => "req_dispute",
    });

    const response = await handlers.getMerchantDispute({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        disputeId: "dp_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: dispute,
        requestId: "req_dispute",
      },
    });
  });

  test("returns success responses for dispute actions", async () => {
    const handlers = createDisputesHttpHandlers({
      service: createService(),
      createRequestId: () => "req_dispute_action",
    });

    await expect(
      handlers.acceptDispute({
        body: { environment: "sandbox", merchantAccountId: "merchant_123", disputeId: "dp_123" },
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: { data: { dispute: { responseState: "accepted" } } },
    });
    await expect(
      handlers.createDisputeEvidence({
        body: {
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          disputeId: "dp_123",
          fileRef: {
            provider: "finix",
            objectType: "file",
            objectId: "FILE_123",
            relationship: "dispute_file",
            recordedAt: "2026-05-14T15:00:00.000Z",
          },
        },
      }),
    ).resolves.toMatchObject({ status: 201, body: { data: { evidence: { state: "PENDING" } } } });
    await expect(
      handlers.listDisputeEvidence({
        body: { environment: "sandbox", merchantAccountId: "merchant_123", disputeId: "dp_123" },
      }),
    ).resolves.toMatchObject({ status: 200, body: { data: { items: [{ state: "PENDING" }] } } });
    await expect(
      handlers.submitDisputeEvidence({
        body: {
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          disputeId: "dp_123",
          note: "Receipt and fulfillment evidence attached.",
        },
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: { data: { dispute: { evidenceStatus: "submitted" } } },
    });
    await expect(
      handlers.listDisputeAdjustmentTransfers({
        body: { environment: "sandbox", merchantAccountId: "merchant_123", disputeId: "dp_123" },
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: { data: { items: [{ amount: 900, currency: "USD" }] } },
    });
  });
});
