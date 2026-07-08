import { describe, expect, test } from "vitest";
import type { PaymentsStateReader } from "../../application/state/service";
import { createMerchantStateHttpHandlers } from "./merchant-state";

describe("createMerchantStateHttpHandlers", () => {
  test("returns success response for merchant account state", async () => {
    const reader: PaymentsStateReader = {
      async getMerchantAccountState() {
        return {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          merchantStatus: "active",
          openRequirementIds: [],
          activeCapabilityKeys: ["card_payments"],
          restrictedCapabilityKeys: [],
          canAcceptPayments: true,
          payoutReadiness: "ready",
          capabilitySnapshots: [],
          generatedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async getMerchantAccountCapabilities() {
        return {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          activeCapabilityKeys: ["card_payments"],
          restrictedCapabilityKeys: ["payouts"],
          capabilities: [
            {
              id: "cap_123",
              environment: "sandbox",
              merchantAccountId: "merchant_123",
              capabilityKey: "card_payments",
              status: "active",
              effectiveAt: "2026-04-23T11:00:00.000Z",
              updatedByType: "system",
            },
          ],
          generatedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async getCustomerPaymentState() {
        return null;
      },
    };

    const handlers = createMerchantStateHttpHandlers({
      reader,
      createRequestId: () => "req_123",
    });

    const response = await handlers.getMerchantAccountState({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          merchantStatus: "active",
          openRequirementIds: [],
          activeCapabilityKeys: ["card_payments"],
          restrictedCapabilityKeys: [],
          canAcceptPayments: true,
          payoutReadiness: "ready",
          capabilitySnapshots: [],
          generatedAt: "2026-04-23T12:00:00.000Z",
        },
        requestId: "req_123",
      },
    });
  });

  test("returns success response for merchant account capabilities", async () => {
    const reader: PaymentsStateReader = {
      async getMerchantAccountState() {
        return null;
      },
      async getMerchantAccountCapabilities() {
        return {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          activeCapabilityKeys: ["card_payments"],
          restrictedCapabilityKeys: ["payouts"],
          capabilities: [
            {
              id: "cap_123",
              environment: "sandbox",
              merchantAccountId: "merchant_123",
              capabilityKey: "card_payments",
              status: "active",
              effectiveAt: "2026-04-23T11:00:00.000Z",
              updatedByType: "system",
            },
          ],
          generatedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async getCustomerPaymentState() {
        return null;
      },
    };

    const handlers = createMerchantStateHttpHandlers({
      reader,
      createRequestId: () => "req_caps_123",
    });

    const response = await handlers.getMerchantAccountCapabilities({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          activeCapabilityKeys: ["card_payments"],
          restrictedCapabilityKeys: ["payouts"],
          capabilities: [
            {
              id: "cap_123",
              environment: "sandbox",
              merchantAccountId: "merchant_123",
              capabilityKey: "card_payments",
              status: "active",
              effectiveAt: "2026-04-23T11:00:00.000Z",
              updatedByType: "system",
            },
          ],
          generatedAt: "2026-04-23T12:00:00.000Z",
        },
        requestId: "req_caps_123",
      },
    });
  });
});
