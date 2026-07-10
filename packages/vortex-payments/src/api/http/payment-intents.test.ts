import { describe, expect, test } from "vitest";
import type { PaymentsService } from "../../application/payments/service";
import { PaymentsServiceError } from "../../application/payments/impl";
import { createPaymentIntentsHttpHandlers } from "./payment-intents";

describe("createPaymentIntentsHttpHandlers", () => {
  test("returns success response for created payment intent", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        return {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "requires_action",
          amount: 500,
          currency: "USD",
          requiresAction: true,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "complete_required_action",
          nextActionType: "redirect",
          hostedActionUrl: "https://pay.vortex.test/action",
        };
      },
      async getPaymentIntent() {
        return null;
      },
      async listPaymentIntents() {
        return [];
      },
      async capturePaymentIntent() {
        throw new Error("not used");
      },
      async cancelPaymentIntent() {
        throw new Error("not used");
      },
      async retryPaymentIntent() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_123",
    });

    const response = await handlers.createPaymentIntent({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_123",
        externalPaymentRef: "order_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
        returnUrl: "https://example.com/return",
        fraudSessionId: "fraud_123",
        metadata: { invoiceId: "inv_123" },
        idempotencyKey: "idem_123",
      },
    });

    expect(response).toEqual({
      status: 201,
      body: {
        data: {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "requires_action",
          amount: 500,
          currency: "USD",
          requiresAction: true,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "complete_required_action",
          nextActionType: "redirect",
          hostedActionUrl: "https://pay.vortex.test/action",
        },
        requestId: "req_123",
      },
    });
  });

  test("returns success response for stored payment intent", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async getPaymentIntent() {
        return {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "captured",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "none",
          nextActionType: undefined,
          hostedActionUrl: undefined,
        };
      },
      async listPaymentIntents() {
        return [];
      },
      async capturePaymentIntent() {
        throw new Error("not used");
      },
      async cancelPaymentIntent() {
        throw new Error("not used");
      },
      async retryPaymentIntent() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_get_123",
    });

    const response = await handlers.getPaymentIntent({
      body: {
        environment: "sandbox",
        paymentIntentId: "pi_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "captured",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "none",
          nextActionType: undefined,
          hostedActionUrl: undefined,
        },
        requestId: "req_get_123",
      },
    });
  });

  test("returns success response for payment intent list", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async getPaymentIntent() {
        return null;
      },
      async listPaymentIntents() {
        return [
          {
            id: "pi_123",
            paymentId: "pay_123",
            merchantAccountId: "merchant_123",
            customerProfileId: "customer_123",
            paymentMethodId: "pm_123",
            status: "authorized",
            amount: 500,
            currency: "USD",
            requiresAction: false,
            canCapture: true,
            canCancel: true,
            canRetry: false,
            nextStep: "capture",
          },
        ];
      },
      async capturePaymentIntent() {
        throw new Error("not used");
      },
      async cancelPaymentIntent() {
        throw new Error("not used");
      },
      async retryPaymentIntent() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_list_123",
    });

    const response = await handlers.listPaymentIntents({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        status: "authorized",
        limit: 10,
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: [
          {
            id: "pi_123",
            paymentId: "pay_123",
            merchantAccountId: "merchant_123",
            customerProfileId: "customer_123",
            paymentMethodId: "pm_123",
            status: "authorized",
            amount: 500,
            currency: "USD",
            requiresAction: false,
            canCapture: true,
            canCancel: true,
            canRetry: false,
            nextStep: "capture",
          },
        ],
        requestId: "req_list_123",
      },
    });
  });

  test("returns success response for payment intent capture", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async getPaymentIntent() {
        return null;
      },
      async listPaymentIntents() {
        return [];
      },
      async capturePaymentIntent() {
        return {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "captured",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "none",
        };
      },
      async cancelPaymentIntent() {
        throw new Error("not used");
      },
      async retryPaymentIntent() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_capture_123",
    });

    const response = await handlers.capturePaymentIntent({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_123",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "captured",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "none",
        },
        requestId: "req_capture_123",
      },
    });
  });

  test("returns success response for payment intent cancel", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async getPaymentIntent() {
        return null;
      },
      async listPaymentIntents() {
        return [];
      },
      async capturePaymentIntent() {
        throw new Error("not used");
      },
      async cancelPaymentIntent() {
        return {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "canceled",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: true,
          nextStep: "retry",
        };
      },
      async retryPaymentIntent() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_cancel_123",
    });

    const response = await handlers.cancelPaymentIntent({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_123",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          id: "pi_123",
          paymentId: "pay_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_123",
          status: "canceled",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: true,
          nextStep: "retry",
        },
        requestId: "req_cancel_123",
      },
    });
  });

  test("returns success response for payment intent retry", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async getPaymentIntent() {
        return null;
      },
      async listPaymentIntents() {
        return [];
      },
      async capturePaymentIntent() {
        throw new Error("not used");
      },
      async cancelPaymentIntent() {
        throw new Error("not used");
      },
      async retryPaymentIntent() {
        return {
          id: "pi_retry_123",
          paymentId: "pay_retry_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_456",
          status: "captured",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "none",
        };
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_retry_123",
    });

    const response = await handlers.retryPaymentIntent({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_123",
        paymentMethodId: "pm_456",
        idempotencyKey: "idem_retry_123",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          id: "pi_retry_123",
          paymentId: "pay_retry_123",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodId: "pm_456",
          status: "captured",
          amount: 500,
          currency: "USD",
          requiresAction: false,
          canCapture: false,
          canCancel: false,
          canRetry: false,
          nextStep: "none",
        },
        requestId: "req_retry_123",
      },
    });
  });

  test("maps service error to http error", async () => {
    const service: PaymentsService = {
      async createPaymentIntent() {
        throw new PaymentsServiceError("action_required", "payment method required", {
          retryable: false,
        });
      },
      async getPaymentIntent() {
        return null;
      },
      async listPaymentIntents() {
        return [];
      },
      async capturePaymentIntent() {
        throw new Error("not used");
      },
      async cancelPaymentIntent() {
        throw new Error("not used");
      },
      async retryPaymentIntent() {
        throw new Error("not used");
      },
    };

    const handlers = createPaymentIntentsHttpHandlers({
      service,
      createRequestId: () => "req_456",
    });

    const response = await handlers.createPaymentIntent({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
      },
    });

    expect(response).toEqual({
      status: 422,
      body: {
        code: "action_required",
        category: "payments_service",
        message: "payment method required",
        actionRequired: true,
        retryable: false,
        requestId: "req_456",
      },
    });
  });
});
