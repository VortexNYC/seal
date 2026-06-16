import { describe, expect, test } from "vitest";
import type { PaymentMethodSetupService } from "../../application/payment-method-setup/service";
import { PaymentMethodSetupServiceError } from "../../application/payment-method-setup/impl";
import { createPaymentMethodSetupHttpHandlers } from "./payment-method-setup";

describe("createPaymentMethodSetupHttpHandlers", () => {
  test("returns success response for setup session creation", async () => {
    const service: PaymentMethodSetupService = {
      async createPaymentMethodSetupSession() {
        return {
          id: "pmset_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "pending_tokenization",
          clientSecret: "pmsec_123",
          setAsDefault: true,
          expiresAt: "2026-04-23T12:30:00.000Z",
          createdAt: "2026-04-23T12:00:00.000Z",
          updatedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async createPaymentMethodFromSetup() {
        return {
          id: "pm_123",
          merchantAccountId: "merchant_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "active",
          isDefault: true,
        };
      },
    };

    const handlers = createPaymentMethodSetupHttpHandlers({
      service,
      createRequestId: () => "req_123",
    });

    const response = await handlers.createPaymentMethodSetupSession({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        setAsDefault: true,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        status: "pending_tokenization",
        clientSecret: "pmsec_123",
        setAsDefault: true,
        expiresAt: "2026-04-23T12:30:00.000Z",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
      requestId: "req_123",
    });
  });

  test("maps service error to http error", async () => {
    const service: PaymentMethodSetupService = {
      async createPaymentMethodSetupSession() {
        throw new PaymentMethodSetupServiceError("provider_unavailable", "provider down", {
          retryable: true,
        });
      },
      async createPaymentMethodFromSetup() {
        throw new PaymentMethodSetupServiceError("internal_error", "nope");
      },
    };

    const handlers = createPaymentMethodSetupHttpHandlers({
      service,
      createRequestId: () => "req_456",
    });

    const response = await handlers.createPaymentMethodSetupSession({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
      },
    });

    expect(response).toEqual({
      status: 503,
      body: {
        code: "provider_unavailable",
        category: "payment_method_setup_service",
        message: "provider down",
        actionRequired: false,
        retryable: true,
        requestId: "req_456",
      },
    });
  });
});
