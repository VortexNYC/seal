import { describe, expect, test } from "vitest";

import {
  buildCreatePayableRequest,
  buildCreateRecurringPayableRequest,
  readVortexBillingEnv,
  selectDocumentPaymentProvider,
} from "./payable_actions";

type BuildPayableInput = Parameters<typeof buildCreatePayableRequest>[0];
type BuildRecurringPayableInput = Parameters<typeof buildCreateRecurringPayableRequest>[0];

const baseConfig: BuildPayableInput["config"] = {
  _id: "seal_config_123",
  fieldId: "seal_field_123",
  documentId: "seal_doc_123",
  organizationId: "org_seal_123",
  paymentType: "one_time",
  items: [
    {
      id: "seal_line_1",
      description: "Seal document payment",
      quantity: 2,
      unitPrice: 2100,
    },
  ],
  currency: "usd",
  dueDateTerms: "net_30",
  customDueDays: undefined,
  customDueDate: undefined,
  totalAmountCents: 4200,
  feeHandling: "pass_to_recipient",
  taxEnabled: false,
};

describe("Vortex Billing document payable bridge", () => {
  test("selects Vortex only for allowlisted supported non-tax document payments", () => {
    expect(selectDocumentPaymentProvider("org_1", [baseConfig], {})).toBe("stripe");
    expect(
      selectDocumentPaymentProvider("org_seal_123", [baseConfig], {
        VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: JSON.stringify(["org_seal_123"]),
      }),
    ).toBe("vortex_billing");
    expect(
      selectDocumentPaymentProvider("org_seal_123", [{ ...baseConfig, paymentType: "recurring" }], {
        VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: "*",
      }),
    ).toBe("vortex_billing");
    expect(
      selectDocumentPaymentProvider("org_seal_123", [baseConfig], {
        VORTEX_BILLING_PAYABLE_ORGANIZATION_IDS: JSON.stringify(["org_seal_123"]),
      }),
    ).toBe("vortex_billing");
    expect(
      selectDocumentPaymentProvider(
        "org_seal_123",
        [{ ...baseConfig, paymentType: "installments" }],
        { VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: "*" },
      ),
    ).toBe("stripe");
    expect(
      selectDocumentPaymentProvider("org_seal_123", [{ ...baseConfig, taxEnabled: true }], {
        VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: "*",
      }),
    ).toBe("stripe");
  });

  test("builds a Vortex payable request from a Seal one-time payment config", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      paymentsEnvironment: "sandbox",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      merchantAccountMapJson: JSON.stringify({ org_seal_123: "ma_seal_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_seal_line_1" }),
    });

    const request = buildCreatePayableRequest({
      config: baseConfig,
      recipient: { email: "buyer@seal.test", name: "Seal Buyer" },
      env,
      now: Date.UTC(2026, 0, 1),
    });

    expect(request).toMatchObject({
      sourceType: "document_payment_field",
      sourceId: "seal_config_123",
      documentId: "seal_doc_123",
      paymentFieldId: "seal_field_123",
      customerExternalId: "cust_seal_123",
      billingAccountId: "bacc_seal_123",
      collectionIntent: "manual",
      dueAt: "2026-01-31T00:00:00.000Z",
      metadata: {
        sourceSystem: "seal",
        vortexPaymentsEnvironment: "sandbox",
        sealOrganizationId: "org_seal_123",
        sealDocumentId: "seal_doc_123",
        sealPaymentFieldId: "seal_field_123",
        sealPaymentConfigId: "seal_config_123",
        recipientEmail: "buyer@seal.test",
        recipientName: "Seal Buyer",
        vortexMerchantAccountId: "ma_seal_123",
      },
    });
    expect(request.lineItems).toEqual([
      {
        priceId: "price_seal_line_1",
        quantity: 2,
        taxable: false,
        metadata: {
          sealLineItemId: "seal_line_1",
          sealLineItemDescription: "Seal document payment",
          sealLineItemUnitPrice: "2100",
        },
      },
    ]);
    expect(request.feePolicy).toMatchObject({
      ownerMode: "customer_pays_processing",
      platformFee: { mode: "none" },
      source: {
        scope: "document_payment_field",
        scopeId: "seal_config_123",
      },
    });
  });

  test("builds a Vortex recurring payable request from a Seal recurring payment config", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      sourceNamespace: "seal-proof",
      paymentsEnvironment: "sandbox",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      merchantAccountMapJson: JSON.stringify({ org_seal_123: "ma_seal_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_seal_line_1" }),
    });
    const recurringConfig: BuildRecurringPayableInput["config"] = {
      ...baseConfig,
      paymentType: "recurring",
      recurringConfig: {
        interval: "month",
        intervalCount: 1,
        endCondition: "after_count",
        endAfterCount: 2,
      },
    };

    const request = buildCreateRecurringPayableRequest({
      config: recurringConfig,
      recipient: { email: "buyer@seal.test", name: "Seal Buyer" },
      env,
      now: Date.UTC(2026, 0, 1),
    });

    expect(request).toMatchObject({
      sourceType: "document_payment_field",
      sourceId: "seal_config_123",
      documentId: "seal_doc_123",
      paymentFieldId: "seal_field_123",
      customerExternalId: "cust_seal_123",
      billingAccountId: "bacc_seal_123",
      merchantAccountId: "ma_seal_123",
      currency: "USD",
      taxMode: "not_taxable",
      collectionIntent: "manual",
      cadence: {
        interval: "month",
        intervalCount: 1,
      },
      endPolicy: {
        mode: "after_count",
        cycleCount: 2,
      },
      startAt: "2026-01-01T00:00:00.000Z",
      metadata: {
        sourceSystem: "seal-proof",
        vortexPaymentsEnvironment: "sandbox",
        sealPaymentType: "recurring",
        recipientEmail: "buyer@seal.test",
      },
    });
    expect(request.lineItems).toEqual([
      {
        priceId: "price_seal_line_1",
        quantity: 2,
        taxable: false,
        metadata: {
          sealLineItemId: "seal_line_1",
          sealLineItemDescription: "Seal document payment",
          sealLineItemUnitPrice: "2100",
        },
      },
    ]);
    expect(request.feePolicy.ownerMode).toBe("customer_pays_processing");
  });

  test("maps absorbed Seal fees to merchant-pays-processing", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_seal_line_1" }),
    });

    const request = buildCreatePayableRequest({
      config: { ...baseConfig, feeHandling: "absorb" },
      recipient: { email: "buyer@seal.test", name: undefined },
      env,
      now: Date.UTC(2026, 0, 1),
    });

    expect(request.feePolicy.ownerMode).toBe("merchant_pays_processing");
  });

  test("fails closed when required Vortex mappings are missing", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      customerMapJson: JSON.stringify({}),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_seal_line_1" }),
    });

    expect(() =>
      buildCreatePayableRequest({
        config: baseConfig,
        recipient: { email: "buyer@seal.test", name: undefined },
        env,
        now: Date.UTC(2026, 0, 1),
      }),
    ).toThrow(/customer missing/);

    const envWithoutPrice = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      priceMapJson: JSON.stringify({}),
    });
    expect(() =>
      buildCreatePayableRequest({
        config: baseConfig,
        recipient: { email: "buyer@seal.test", name: undefined },
        env: envWithoutPrice,
        now: Date.UTC(2026, 0, 1),
      }),
    ).toThrow(/price missing/);
  });
});
