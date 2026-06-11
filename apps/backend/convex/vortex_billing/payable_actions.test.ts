import { describe, expect, test } from "vitest";

import {
  buildCreateDepositBalancePayableRequest,
  buildCreateInstallmentPayableRequest,
  buildCreatePayableRequest,
  buildCreateRecurringPayableRequest,
  readVortexBillingEnv,
} from "./payable_actions";

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

function makeEnv() {
  return readVortexBillingEnv({
    apiBaseUrl: "https://billing.vortex.test/",
    apiKey: "vb_test_key",
    sourceNamespace: "seal",
    customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_123" }),
    billingAccountMapJson: JSON.stringify({ organization_1: "bacc_123" }),
    merchantAccountMapJson: JSON.stringify({ organization_1: "ma_123" }),
    priceMapJson: JSON.stringify({
      seal_line_1: "price_123",
      "seal_line_1:deposit": "price_deposit_123",
      "seal_line_1:balance": "price_balance_123",
    }),
  });
}

describe("Vortex Billing payable bridge", () => {
  test("builds a one-time Vortex payable request from a Seal payment field", () => {
    const env = makeEnv();

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

  test("builds a recurring Vortex payable request from a Seal recurring payment field", () => {
    const request = buildCreateRecurringPayableRequest({
      config: makePaymentConfig({
        paymentType: "recurring",
        recurringConfig: {
          interval: "month",
          intervalCount: 1,
          endCondition: "after_count",
          endAfterCount: 3,
        },
      }),
      recipient: { email: "buyer@seal.test", name: "Buyer" },
      env: makeEnv(),
      now: Date.UTC(2026, 0, 1),
    });

    expect(request).toMatchObject({
      sourceId: "seal:payment_config_1",
      merchantAccountId: "ma_123",
      currency: "USD",
      taxMode: "not_taxable",
      cadence: {
        interval: "month",
        intervalCount: 1,
      },
      endPolicy: {
        mode: "after_count",
        cycleCount: 3,
      },
      startAt: "2026-01-01T00:00:00.000Z",
      metadata: {
        sealPaymentType: "recurring",
        sealRecurringInterval: "month",
        sealRecurringIntervalCount: "1",
        sealRecurringEndCondition: "after_count",
        sealRecurringEndAfterCount: "3",
      },
    });
  });

  test("builds an installment Vortex payable request from a Seal installment payment field", () => {
    const request = buildCreateInstallmentPayableRequest({
      config: makePaymentConfig({
        paymentType: "installments",
        totalAmountCents: 10001,
        installmentsConfig: {
          count: 3,
          interval: "month",
        },
      }),
      recipient: { email: "buyer@seal.test", name: "Buyer" },
      env: makeEnv(),
      now: Date.UTC(2026, 0, 1),
    });

    expect(request.installments.map((installment) => installment.amountDue)).toEqual([
      3333,
      3333,
      3335,
    ]);
    expect(request.installments.map((installment) => installment.dueAt)).toEqual([
      "2026-01-31T00:00:00.000Z",
      "2026-02-28T00:00:00.000Z",
      "2026-03-31T00:00:00.000Z",
    ]);
    expect(request).toMatchObject({
      sourceId: "seal:payment_config_1",
      merchantAccountId: "ma_123",
      currency: "USD",
      taxMode: "not_taxable",
      metadata: {
        sealPaymentType: "installments",
        sealInstallmentsCount: "3",
        sealInstallmentsInterval: "month",
      },
    });
  });

  test("builds a deposit and balance Vortex payable request from a Seal split payment field", () => {
    const request = buildCreateDepositBalancePayableRequest({
      config: makePaymentConfig({
        paymentType: "deposit_balance",
        totalAmountCents: 20000,
        depositBalanceConfig: {
          depositPercent: 25,
          balanceDueDays: 30,
        },
      }),
      recipient: { email: "buyer@seal.test", name: "Buyer" },
      env: makeEnv(),
      now: Date.UTC(2026, 0, 1),
    });

    expect(request).toMatchObject({
      sourceId: "seal:payment_config_1",
      merchantAccountId: "ma_123",
      currency: "USD",
      taxMode: "not_taxable",
      deposit: {
        dueAt: "2026-01-01T00:00:00.000Z",
        amountDue: 5000,
        lineItems: [
          {
            priceId: "price_deposit_123",
            metadata: {
              sealDepositBalancePart: "deposit",
              sealDepositBalancePartAmountDueCents: "5000",
            },
          },
        ],
      },
      balance: {
        dueAt: "2026-01-31T00:00:00.000Z",
        amountDue: 15000,
        lineItems: [
          {
            priceId: "price_balance_123",
            metadata: {
              sealDepositBalancePart: "balance",
              sealDepositBalancePartAmountDueCents: "15000",
            },
          },
        ],
      },
      metadata: {
        sealPaymentType: "deposit_balance",
        sealDepositPercent: "25",
        sealDepositAmountCents: "5000",
        sealBalanceAmountCents: "15000",
        sealBalanceDueDays: "30",
      },
    });
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
