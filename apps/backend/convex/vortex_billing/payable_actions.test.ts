import { describe, expect, test } from "vitest";

import { buildCreatePayableRequest, readVortexBillingEnv } from "./payable_actions";

type TestPaymentConfig = Parameters<typeof buildCreatePayableRequest>[0]["config"];

function makePaymentConfig(overrides: Partial<TestPaymentConfig> = {}): TestPaymentConfig {
  return {
    _id: "payment_config_1" as TestPaymentConfig["_id"],
    fieldId: "payment_field_1" as TestPaymentConfig["fieldId"],
    documentId: "document_1" as TestPaymentConfig["documentId"],
    organizationId: "organization_1" as TestPaymentConfig["organizationId"],
    paymentType: "one_time",
    items: [
      {
        id: "seal_line_1",
        description: "Document payment",
        quantity: 1,
        unitPrice: 4200,
      },
    ],
    currency: "usd",
    dueDateTerms: "net_30",
    customDueDays: undefined,
    customDueDate: undefined,
    totalAmountCents: 4200,
    feeHandling: "pass_to_recipient",
    taxEnabled: false,
    ...overrides,
  };
}

describe("Vortex Billing payable bridge", () => {
  test("builds a one-time Vortex payable request from a Seal payment field", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://billing.vortex.test/",
      apiKey: "vb_test_key",
      sourceNamespace: "seal",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_123" }),
      billingAccountMapJson: JSON.stringify({ organization_1: "bacc_123" }),
      merchantAccountMapJson: JSON.stringify({ organization_1: "ma_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_123" }),
    });

    const request = buildCreatePayableRequest({
      config: makePaymentConfig(),
      recipient: { email: "buyer@seal.test", name: "Buyer" },
      env,
      now: Date.UTC(2026, 0, 1),
    });

    expect(request).toMatchObject({
      sourceType: "document_payment_field",
      sourceId: "seal:payment_config_1",
      documentId: "document_1",
      paymentFieldId: "payment_field_1",
      customerExternalId: "cust_123",
      billingAccountId: "bacc_123",
      collectionIntent: "manual",
      dueAt: "2026-01-31T00:00:00.000Z",
      metadata: {
        sourceSystem: "seal",
        vortexMerchantAccountId: "ma_123",
        sealDocumentId: "document_1",
        sealPaymentFieldConfigId: "payment_config_1",
        sealPaymentFieldId: "payment_field_1",
        sealRecipientEmail: "buyer@seal.test",
        sealRecipientName: "Buyer",
        sealPaymentType: "one_time",
        sealTotalAmountCents: "4200",
        sealCurrency: "usd",
      },
    });
    expect(request.feePolicy.ownerMode).toBe("customer_pays_processing");
    expect(request.lineItems).toEqual([
      {
        priceId: "price_123",
        quantity: 1,
        taxable: false,
        metadata: {
          sealLineItemId: "seal_line_1",
          sealLineItemDescription: "Document payment",
          sealLineItemUnitPriceCents: "4200",
        },
      },
    ]);
  });

  test("rejects non-one-time Seal payment types", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://billing.vortex.test",
      apiKey: "vb_test_key",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_123" }),
      defaultBillingAccountId: "bacc_123",
      defaultMerchantAccountId: "ma_123",
      priceMapJson: JSON.stringify({ seal_line_1: "price_123" }),
    });

    expect(() =>
      buildCreatePayableRequest({
        config: makePaymentConfig({ paymentType: "recurring" }),
        recipient: { email: "buyer@seal.test", name: "Buyer" },
        env,
        now: Date.UTC(2026, 0, 1),
      }),
    ).toThrow("only supports one_time payment fields");
  });

  test("requires explicit customer and price mappings", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://billing.vortex.test",
      apiKey: "vb_test_key",
      defaultBillingAccountId: "bacc_123",
      defaultMerchantAccountId: "ma_123",
      priceMapJson: JSON.stringify({}),
    });

    expect(() =>
      buildCreatePayableRequest({
        config: makePaymentConfig(),
        recipient: { email: "buyer@seal.test", name: "Buyer" },
        env,
        now: Date.UTC(2026, 0, 1),
      }),
    ).toThrow("Missing Vortex customer mapping");
  });

  test("requires explicit merchant and billing account mappings", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://billing.vortex.test",
      apiKey: "vb_test_key",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_123" }),
    });

    expect(() =>
      buildCreatePayableRequest({
        config: makePaymentConfig(),
        recipient: { email: "buyer@seal.test", name: "Buyer" },
        env,
        now: Date.UTC(2026, 0, 1),
      }),
    ).toThrow("Missing Vortex merchant account mapping");

    const merchantOnlyEnv = readVortexBillingEnv({
      apiBaseUrl: "https://billing.vortex.test",
      apiKey: "vb_test_key",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_123" }),
      defaultMerchantAccountId: "ma_123",
      priceMapJson: JSON.stringify({ seal_line_1: "price_123" }),
    });

    expect(() =>
      buildCreatePayableRequest({
        config: makePaymentConfig(),
        recipient: { email: "buyer@seal.test", name: "Buyer" },
        env: merchantOnlyEnv,
        now: Date.UTC(2026, 0, 1),
      }),
    ).toThrow("Missing Vortex billing account mapping");
  });
});
