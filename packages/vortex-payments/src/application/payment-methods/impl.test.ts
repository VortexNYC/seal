import { describe, expect, test } from "vitest";
import type { PaymentIntent } from "../../domain/payments";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import { createPaymentMethodsService, type PaymentMethodsServiceError } from "./impl";

function createPaymentMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: "pm_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    ownerType: "customer",
    ownerId: "customer_123",
    methodType: "card",
    status: "active",
    isDefault: true,
    processorInstrumentRefs: [
      {
        provider: "finix",
        objectType: "payment_instrument",
        objectId: "pi_123",
        relationship: "payment_method",
        recordedAt: "2026-04-23T12:00:00.000Z",
      },
    ],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

function createPaymentIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: "pi_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    customerProfileId: "customer_123",
    amount: 500,
    currency: "USD",
    captureMode: "automatic",
    status: "pending",
    processorIntentRefs: [],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("createPaymentMethodsService", () => {
  test("lists only customer payment methods", async () => {
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod(),
        createPaymentMethod({ id: "pm_merchant", ownerType: "merchant", ownerId: "merchant_123" }),
      ],
      savePaymentMethod: async () => {},
      listPaymentIntents: async () => [],
    });

    const result = await service.listCustomerPaymentMethods({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("pm_123");
  });

  test("gets one customer payment method within scope", async () => {
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({ id: "pm_123" }),
        createPaymentMethod({ id: "pm_other", ownerId: "customer_other" }),
      ],
      savePaymentMethod: async () => {},
      listPaymentIntents: async () => [],
    });

    await expect(
      service.getCustomerPaymentMethod({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_123",
      }),
    ).resolves.toMatchObject({ id: "pm_123" });

    await expect(
      service.getCustomerPaymentMethod({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_other",
      }),
    ).resolves.toBeNull();
  });

  test("sets default customer payment method", async () => {
    const saved: PaymentMethod[] = [];
    const events: CanonicalDomainEvent[] = [];
    const states: string[] = [];
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({ id: "pm_123", isDefault: true }),
        createPaymentMethod({
          id: "pm_456",
          isDefault: false,
          processorInstrumentRefs: [
            {
              provider: "finix",
              objectType: "payment_instrument",
              objectId: "pi_456",
              relationship: "payment_method",
              recordedAt: "2026-04-23T12:00:00.000Z",
            },
          ],
        }),
      ],
      savePaymentMethod: async (record) => {
        saved.push(record);
      },
      listPaymentIntents: async () => [],
      saveCustomerPaymentState: async (state) => {
        states.push(state.defaultPaymentMethodId ?? "");
      },
      saveCanonicalEvent: async (event) => {
        events.push(event);
      },
      now: () => "2026-04-23T12:05:00.000Z",
    });

    const result = await service.setDefaultCustomerPaymentMethod({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_456",
    });

    expect(result.find((method) => method.id === "pm_456")?.isDefault).toBe(true);
    expect(saved).toHaveLength(2);
    expect(states).toEqual(["pm_456"]);
    expect(events).toContainEqual(
      expect.objectContaining({
        eventType: "payment_method.updated",
        aggregateId: "pm_456",
        payload: expect.objectContaining({
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          paymentMethodStatus: "active",
          isDefault: true,
          action: "default_changed",
        }),
      }),
    );
  });

  test("archives payment method and promotes fallback default", async () => {
    const saved: PaymentMethod[] = [];
    const events: CanonicalDomainEvent[] = [];
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({ id: "pm_123", isDefault: true }),
        createPaymentMethod({
          id: "pm_456",
          isDefault: false,
          processorInstrumentRefs: [
            {
              provider: "finix",
              objectType: "payment_instrument",
              objectId: "pi_456",
              relationship: "payment_method",
              recordedAt: "2026-04-23T12:00:00.000Z",
            },
          ],
        }),
      ],
      savePaymentMethod: async (record) => {
        saved.push(record);
      },
      listPaymentIntents: async () => [],
      saveCanonicalEvent: async (event) => {
        events.push(event);
      },
      now: () => "2026-04-23T12:05:00.000Z",
    });

    const result = await service.archivePaymentMethod({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
    });

    expect(result).toMatchObject({ id: "pm_123", status: "archived", isDefault: false });
    expect(saved).toHaveLength(2);
    expect(saved.find((record) => record.id === "pm_456")?.isDefault).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({
        eventType: "payment_method.updated",
        aggregateId: "pm_123",
        payload: expect.objectContaining({
          paymentMethodStatus: "archived",
          action: "archived",
        }),
      }),
    );
  });

  test("disables payment method and promotes fallback default", async () => {
    const saved: PaymentMethod[] = [];
    const events: CanonicalDomainEvent[] = [];
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({ id: "pm_123", isDefault: true }),
        createPaymentMethod({ id: "pm_456", isDefault: false }),
      ],
      savePaymentMethod: async (record) => {
        saved.push(record);
      },
      listPaymentIntents: async () => [],
      saveCanonicalEvent: async (event) => {
        events.push(event);
      },
      now: () => "2026-04-23T12:05:00.000Z",
    });

    const result = await service.disablePaymentMethod({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      reason: "issuer_declined_reuse",
    });

    expect(result).toMatchObject({ id: "pm_123", status: "disabled", isDefault: false });
    expect(saved).toHaveLength(2);
    expect(saved.find((record) => record.id === "pm_456")?.isDefault).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({
        eventType: "payment_method.updated",
        aggregateId: "pm_123",
        payload: expect.objectContaining({
          paymentMethodStatus: "disabled",
          action: "disabled",
          reason: "issuer_declined_reuse",
        }),
      }),
    );
  });

  test("rejects disabling archived payment method", async () => {
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({
          id: "pm_123",
          status: "archived",
          isDefault: false,
          archivedAt: "2026-04-23T12:00:00.000Z",
        }),
      ],
      savePaymentMethod: async () => {},
      listPaymentIntents: async () => [],
    });

    await expect(
      service.disablePaymentMethod({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_123",
      }),
    ).rejects.toMatchObject({
      name: "PaymentMethodsServiceError",
      code: "conflict",
    } satisfies Partial<PaymentMethodsServiceError>);
  });

  test("derives customer payment state from methods and payment intents", async () => {
    let capturedDefault: string | undefined;
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({ id: "pm_123", isDefault: true, brandSummary: "visa", last4: "4242" }),
      ],
      savePaymentMethod: async () => {},
      listPaymentIntents: async () => [createPaymentIntent({ status: "requires_action" })],
      saveCustomerPaymentState: async (state) => {
        capturedDefault = state.defaultPaymentMethodId;
      },
    });

    const state = await service.getCustomerPaymentState({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
    });

    expect(state).toMatchObject({
      readiness: "action_required",
      readinessReasons: ["payment_intent_requires_action"],
      defaultPaymentMethodId: "pm_123",
      defaultPaymentMethod: {
        id: "pm_123",
        brandSummary: "visa",
        last4: "4242",
      },
      paymentMethods: [
        {
          id: "pm_123",
          brandSummary: "visa",
          last4: "4242",
        },
      ],
      requiresActionPaymentIntentIds: ["pi_123"],
      requiresActionPaymentIntentCount: 1,
    });
    expect(capturedDefault).toBe("pm_123");
  });

  test("marks customer payment state blocked when methods exist but none are usable", async () => {
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [
        createPaymentMethod({ id: "pm_disabled", status: "disabled", isDefault: false }),
        createPaymentMethod({ id: "pm_archived", status: "archived", isDefault: false }),
      ],
      savePaymentMethod: async () => {},
      listPaymentIntents: async () => [],
    });

    const state = await service.getCustomerPaymentState({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
    });

    expect(state).toMatchObject({
      readiness: "blocked",
      readinessReasons: ["payment_methods_disabled", "payment_methods_archived"],
      defaultPaymentMethodId: undefined,
      requiresActionPaymentIntentCount: 0,
    });
  });

  test("rejects inactive method as default", async () => {
    const service = createPaymentMethodsService({
      listPaymentMethods: async () => [createPaymentMethod({ id: "pm_123", status: "disabled" })],
      savePaymentMethod: async () => {},
      listPaymentIntents: async () => [],
    });

    await expect(
      service.setDefaultCustomerPaymentMethod({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentMethodId: "pm_123",
      }),
    ).rejects.toMatchObject({
      name: "PaymentMethodsServiceError",
      code: "invalid_request",
    } satisfies Partial<PaymentMethodsServiceError>);
  });
});
