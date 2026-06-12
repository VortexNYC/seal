import { describe, expect, test } from "vitest";
import type { PaymentMethodsService } from "../../application/payment-methods/service";
import { PaymentMethodsServiceError } from "../../application/payment-methods/impl";
import { createPaymentMethodsHttpHandlers } from "./payment-methods";

describe("createPaymentMethodsHttpHandlers", () => {
  test("returns success response for customer payment method detail", async () => {
    const service: PaymentMethodsService = {
      async listCustomerPaymentMethods() {
        return [];
      },
      async getCustomerPaymentMethod() {
        return {
          id: "pm_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "active",
          isDefault: true,
          brandSummary: "visa",
          last4: "4242",
        };
      },
      async setDefaultCustomerPaymentMethod() {
        return [];
      },
      async archivePaymentMethod() {
        throw new Error("not used");
      },
      async disablePaymentMethod() {
        throw new Error("not used");
      },
      async getCustomerPaymentState() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentMethodsHttpHandlers({
      service,
      createRequestId: () => "req_detail_123",
    });

    const response = await handlers.getCustomerPaymentMethod({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          id: "pm_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "active",
          isDefault: true,
          brandSummary: "visa",
          last4: "4242",
        },
        requestId: "req_detail_123",
      },
    });
  });

  test("returns success response for customer payment state", async () => {
    const service: PaymentMethodsService = {
      async listCustomerPaymentMethods() {
        return [];
      },
      async getCustomerPaymentMethod() {
        return {
          id: "pm_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "active",
          isDefault: true,
          brandSummary: "visa",
          last4: "4242",
        };
      },
      async setDefaultCustomerPaymentMethod() {
        return [];
      },
      async archivePaymentMethod() {
        return {
          id: "pm_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "archived",
          isDefault: false,
        };
      },
      async disablePaymentMethod() {
        throw new Error("not used");
      },
      async getCustomerPaymentState() {
        return {
          customerProfileId: "customer_123",
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          defaultPaymentMethodId: "pm_123",
          defaultPaymentMethod: {
            id: "pm_123",
            ownerType: "customer",
            ownerId: "customer_123",
            methodType: "card",
            status: "active",
            isDefault: true,
            brandSummary: "visa",
            last4: "4242",
          },
          paymentMethods: [{
            id: "pm_123",
            ownerType: "customer",
            ownerId: "customer_123",
            methodType: "card",
            status: "active",
            isDefault: true,
            brandSummary: "visa",
            last4: "4242",
          }],
          activePaymentMethodIds: ["pm_123"],
          requiresActionPaymentIntentIds: [],
          requiresActionPaymentIntentCount: 0,
          latestPaymentIntentStatus: "captured",
          readiness: "ready",
          readinessReasons: [],
          generatedAt: "2026-04-27T19:00:00.000Z",
        };
      },
    };

    const handlers = createPaymentMethodsHttpHandlers({
      service,
      createRequestId: () => "req_123",
    });

    const response = await handlers.getCustomerPaymentState({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          customerProfileId: "customer_123",
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          defaultPaymentMethodId: "pm_123",
          defaultPaymentMethod: {
            id: "pm_123",
            ownerType: "customer",
            ownerId: "customer_123",
            methodType: "card",
            status: "active",
            isDefault: true,
            brandSummary: "visa",
            last4: "4242",
          },
          paymentMethods: [{
            id: "pm_123",
            ownerType: "customer",
            ownerId: "customer_123",
            methodType: "card",
            status: "active",
            isDefault: true,
            brandSummary: "visa",
            last4: "4242",
          }],
          activePaymentMethodIds: ["pm_123"],
          requiresActionPaymentIntentIds: [],
          requiresActionPaymentIntentCount: 0,
          latestPaymentIntentStatus: "captured",
          readiness: "ready",
          readinessReasons: [],
          generatedAt: "2026-04-27T19:00:00.000Z",
        },
        requestId: "req_123",
      },
    });
  });

  test("returns success response for disabled payment method", async () => {
    const service: PaymentMethodsService = {
      async listCustomerPaymentMethods() {
        return [];
      },
      async getCustomerPaymentMethod() {
        return null;
      },
      async setDefaultCustomerPaymentMethod() {
        return [];
      },
      async archivePaymentMethod() {
        throw new Error("not used");
      },
      async disablePaymentMethod() {
        return {
          id: "pm_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "disabled",
          isDefault: false,
        };
      },
      async getCustomerPaymentState() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentMethodsHttpHandlers({
      service,
      createRequestId: () => "req_disable_123",
    });

    const response = await handlers.disablePaymentMethod({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_123",
        reason: "issuer_declined_reuse",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          id: "pm_123",
          ownerType: "customer",
          ownerId: "customer_123",
          methodType: "card",
          status: "disabled",
          isDefault: false,
        },
        requestId: "req_disable_123",
      },
    });
  });

  test("maps service error to http error", async () => {
    const service: PaymentMethodsService = {
      async listCustomerPaymentMethods() {
        throw new PaymentMethodsServiceError("invalid_request", "bad request");
      },
      async getCustomerPaymentMethod() {
        throw new Error("not used");
      },
      async setDefaultCustomerPaymentMethod() {
        return [];
      },
      async archivePaymentMethod() {
        throw new Error("not used");
      },
      async disablePaymentMethod() {
        throw new Error("not used");
      },
      async getCustomerPaymentState() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentMethodsHttpHandlers({
      service,
      createRequestId: () => "req_456",
    });

    const response = await handlers.listCustomerPaymentMethods({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
      },
    });

    expect(response).toEqual({
      status: 400,
      body: {
        code: "invalid_request",
        category: "payment_methods_service",
        message: "bad request",
        actionRequired: false,
        retryable: false,
        requestId: "req_456",
      },
    });
  });
});
