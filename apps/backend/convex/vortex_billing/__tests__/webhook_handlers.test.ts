import { describe, expect, test } from "vitest";

import {
  type VortexWebhookEnvelope,
  parseVortexSubscriptionUpdatedProjection,
} from "../webhook_handlers";

describe("Vortex Billing webhook payload parsing", () => {
  test("extracts the hosted checkout subscription projection contract", () => {
    const event: VortexWebhookEnvelope = {
      id: "evt_vortex_subscription",
      type: "subscription.updated",
      apiVersion: "2026-06-01",
      environment: "sandbox",
      createdAt: Date.now(),
      data: {
        subscription: {
          subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
          customerExternalId: "vtx_cust_seal_org_123",
          planCode: "vtx_price_pro_monthly",
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodStart: "2026-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
          activationReason: "checkout_payment_succeeded",
          paymentRequestId: "preq_123",
          metadata: {
            sourceSystem: "seal",
            sealOrganizationId: "org_123",
            lookupKey: "pro:business:month:v1",
          },
        },
      },
    };

    expect(parseVortexSubscriptionUpdatedProjection(event)).toMatchObject({
      eventId: "evt_vortex_subscription",
      eventType: "subscription.updated",
      sealOrganizationId: "org_123",
      subscriptionExternalId: "vtx_sub_seal_org_123_pro_monthly",
      customerExternalId: "vtx_cust_seal_org_123",
      planCode: "vtx_price_pro_monthly",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: "2026-01-01T00:00:00.000Z",
      currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    });
  });
});
