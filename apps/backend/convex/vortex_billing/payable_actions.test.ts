import { describe, expect, test } from "vitest";

import {
  buildCreateDepositBalancePayableRequest,
  buildCreateInstallmentPayableRequest,
  buildCreatePayableRequest,
  buildCreateRecurringPayableRequest,
  readVortexBillingEnv,
  selectDocumentPaymentProvider,
} from "./payable_actions";

type BuildPayableInput = Parameters<typeof buildCreatePayableRequest>[0];
type BuildRecurringPayableInput = Parameters<typeof buildCreateRecurringPayableRequest>[0];
type BuildInstallmentPayableInput = Parameters<typeof buildCreateInstallmentPayableRequest>[0];
type BuildDepositBalancePayableInput = Parameters<
  typeof buildCreateDepositBalancePayableRequest
>[0];

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
  test("selects Vortex for every document payment configuration", () => {
    expect(selectDocumentPaymentProvider("org_1", [baseConfig], {})).toBe("vortex_billing");
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
    ).toBe("vortex_billing");
    expect(
      selectDocumentPaymentProvider(
        "org_seal_123",
        [{ ...baseConfig, paymentType: "deposit_balance" }],
        { VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: "*" },
      ),
    ).toBe("vortex_billing");
    expect(
      selectDocumentPaymentProvider("org_seal_123", [{ ...baseConfig, taxEnabled: true }], {
        VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: "*",
      }),
    ).toBe("vortex_billing");
    expect(
      selectDocumentPaymentProvider(
        "org_not_allowlisted",
        [{ ...baseConfig, taxEnabled: true }],
        {},
      ),
    ).toBe("vortex_billing");
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

  test("models a resolved Seal card fee as a Vortex fixed platform fee", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_seal_line_1" }),
    });

    const request = buildCreatePayableRequest({
      config: baseConfig,
      recipient: { email: "buyer@seal.test", name: "Seal Buyer" },
      env,
      now: Date.UTC(2026, 0, 1),
      platformFeeCents: 219,
    });

    expect(request.feePolicy.platformFee).toEqual({
      mode: "fixed_amount",
      amount: 219,
      currency: "USD",
      rounding: "half_up",
    });
    expect(request.feePolicy.evidence).toContain("platform_fee:fixed_amount:219:USD:half_up");
    expect(request.feePolicy.execution.stopCondition).toBe(
      "fixed application fee is modeled for Vortex payable creation; Vortex executes it on card charge",
    );
  });

  test("builds taxable Vortex requests with Seal tax behavior and standard classification", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      sourceNamespace: "seal-proof",
      paymentsEnvironment: "sandbox",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      merchantAccountMapJson: JSON.stringify({ org_seal_123: "ma_seal_123" }),
      priceMapJson: JSON.stringify({
        seal_line_1: "price_seal_line_1",
        "seal_line_1:deposit": "price_seal_line_deposit",
        "seal_line_1:balance": "price_seal_line_balance",
      }),
    });
    const recipient = { email: "buyer@seal.test", name: "Seal Buyer" };
    const now = Date.UTC(2026, 0, 1);
    const taxableBaseConfig = {
      ...baseConfig,
      taxEnabled: true,
      taxBehavior: "inclusive",
    } satisfies BuildPayableInput["config"];

    expect(
      buildCreatePayableRequest({
        config: taxableBaseConfig,
        recipient,
        env,
        now,
      }),
    ).toMatchObject({
      taxable: true,
      taxBehavior: "inclusive",
      taxClassificationKey: "standard_taxable",
      lineItems: [{ taxable: false }],
    });

    expect(
      buildCreateRecurringPayableRequest({
        config: {
          ...taxableBaseConfig,
          paymentType: "recurring",
          recurringConfig: {
            interval: "month",
            intervalCount: 1,
            endCondition: "never",
          },
        },
        recipient,
        env,
        now,
      }),
    ).toMatchObject({
      taxMode: "taxable_requires_evidence",
      taxable: true,
      taxBehavior: "inclusive",
      taxClassificationKey: "standard_taxable",
      lineItems: [{ taxable: false }],
    });

    const installmentRequest = buildCreateInstallmentPayableRequest({
      config: {
        ...taxableBaseConfig,
        paymentType: "installments",
        installmentsConfig: {
          count: 2,
          interval: "month",
        },
      },
      recipient,
      env,
      now,
    });
    expect(installmentRequest).toMatchObject({
      taxMode: "taxable_requires_evidence",
      taxable: true,
      taxBehavior: "inclusive",
      taxClassificationKey: "standard_taxable",
    });
    expect(installmentRequest.installments[0]?.lineItems[0]?.taxable).toBe(false);

    const depositBalanceRequest = buildCreateDepositBalancePayableRequest({
      config: {
        ...taxableBaseConfig,
        paymentType: "deposit_balance",
        totalAmountCents: 4200,
        depositBalanceConfig: {
          depositPercent: 50,
          balanceDueDays: 30,
        },
      },
      recipient,
      env,
      now,
    });
    expect(depositBalanceRequest).toMatchObject({
      taxMode: "taxable_requires_evidence",
      taxable: true,
      taxBehavior: "inclusive",
      taxClassificationKey: "standard_taxable",
    });
    expect(depositBalanceRequest.deposit.lineItems[0]?.taxable).toBe(false);
    expect(depositBalanceRequest.balance.lineItems[0]?.taxable).toBe(false);
  });

  test("defaults taxable Vortex request tax behavior to exclusive", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      priceMapJson: JSON.stringify({ seal_line_1: "price_seal_line_1" }),
    });

    const request = buildCreatePayableRequest({
      config: { ...baseConfig, taxEnabled: true },
      recipient: { email: "buyer@seal.test", name: "Seal Buyer" },
      env,
      now: Date.UTC(2026, 0, 1),
    });

    expect(request).toMatchObject({
      taxable: true,
      taxBehavior: "exclusive",
      taxClassificationKey: "standard_taxable",
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

  test("builds a Vortex installment payable request from a Seal installment config", () => {
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
    const installmentConfig: BuildInstallmentPayableInput["config"] = {
      ...baseConfig,
      paymentType: "installments",
      items: [
        {
          id: "seal_line_1",
          description: "Seal document installment",
          quantity: 3,
          unitPrice: 4200,
        },
      ],
      totalAmountCents: 12600,
      installmentsConfig: {
        count: 3,
        interval: "month",
      },
    };

    const request = buildCreateInstallmentPayableRequest({
      config: installmentConfig,
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
      metadata: {
        sourceSystem: "seal-proof",
        vortexPaymentsEnvironment: "sandbox",
        sealPaymentType: "installments",
        recipientEmail: "buyer@seal.test",
      },
    });
    expect(request.installments).toHaveLength(3);
    expect(request.installments.map((installment) => installment.amountDue)).toEqual([
      4200, 4200, 4200,
    ]);
    expect(request.installments[0]).toMatchObject({
      installmentNumber: 1,
      role: "installment",
      dueAt: "2026-01-31T00:00:00.000Z",
      lineItems: [
        {
          priceId: "price_seal_line_1",
          quantity: 1,
          taxable: false,
          metadata: {
            sealLineItemId: "seal_line_1",
            sealLineItemDescription: "Seal document installment",
            sealLineItemUnitPrice: "4200",
          },
        },
      ],
    });
    expect(request.installments[1]?.dueAt).toBe("2026-03-02T00:00:00.000Z");
    expect(request.feePolicy.ownerMode).toBe("customer_pays_processing");
  });

  test("builds a Vortex deposit/balance payable request from a Seal deposit balance config", () => {
    const env = readVortexBillingEnv({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      sourceNamespace: "seal-proof",
      paymentsEnvironment: "sandbox",
      customerMapJson: JSON.stringify({ "buyer@seal.test": "cust_seal_123" }),
      billingAccountMapJson: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      merchantAccountMapJson: JSON.stringify({ org_seal_123: "ma_seal_123" }),
      priceMapJson: JSON.stringify({
        "seal_line_1:deposit": "price_seal_line_deposit",
        "seal_line_1:balance": "price_seal_line_balance",
      }),
    });
    const depositBalanceConfig: BuildDepositBalancePayableInput["config"] = {
      ...baseConfig,
      paymentType: "deposit_balance",
      items: [
        {
          id: "seal_line_1",
          description: "Seal document deposit balance",
          quantity: 1,
          unitPrice: 20000,
        },
      ],
      totalAmountCents: 20000,
      depositBalanceConfig: {
        depositPercent: 25,
        balanceDueDays: 30,
      },
    };

    const request = buildCreateDepositBalancePayableRequest({
      config: depositBalanceConfig,
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
      metadata: {
        sourceSystem: "seal-proof",
        vortexPaymentsEnvironment: "sandbox",
        sealPaymentType: "deposit_balance",
        recipientEmail: "buyer@seal.test",
      },
    });
    expect(request.deposit).toEqual({
      dueAt: "2026-01-31T00:00:00.000Z",
      amountDue: 5000,
      lineItems: [
        {
          priceId: "price_seal_line_deposit",
          quantity: 1,
          taxable: false,
          metadata: {
            sealLineItemId: "seal_line_1:deposit",
            sealLineItemDescription: "Seal document deposit balance (deposit)",
            sealLineItemUnitPrice: "5000",
          },
        },
      ],
    });
    expect(request.balance).toEqual({
      dueAt: "2026-03-02T00:00:00.000Z",
      amountDue: 15000,
      lineItems: [
        {
          priceId: "price_seal_line_balance",
          quantity: 1,
          taxable: false,
          metadata: {
            sealLineItemId: "seal_line_1:balance",
            sealLineItemDescription: "Seal document deposit balance (balance)",
            sealLineItemUnitPrice: "15000",
          },
        },
      ],
    });
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
