"use node";

import {
  allocate,
  applyRate,
  money,
  subtractMoney,
} from "@vortexnyc/money";
import {
  createDepositBalancePayable,
  createInstallmentPayable,
  createPayable,
  createRecurringPayable,
} from "@vortexnyc/payments-sdk";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { createVortexBillingClient } from "../payments/vortex_billing_processor";

/** Stripe / US banking: round-half-up per portion. */
const MONEY_ROUNDING = "half-up" as const;
const PAYABLE_CURRENCY = "USD";

type Env = {
  readonly [key: string]: string | undefined;
};

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

export type DocumentPaymentProvider = "vortex_billing";

export type VortexBillingEnvInput = {
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly sourceNamespace?: string;
  readonly customerMapJson?: string;
  readonly billingAccountMapJson?: string;
  readonly defaultBillingAccountId?: string;
  readonly merchantAccountMapJson?: string;
  readonly defaultMerchantAccountId?: string;
  readonly paymentsEnvironment?: string;
  readonly priceMapJson?: string;
  readonly defaultPriceId?: string;
};

export type VortexBillingEnv = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly sourceNamespace: string;
  readonly paymentsEnvironment: string;
  readonly customerMap: Record<string, string>;
  readonly billingAccountMap: Record<string, string>;
  readonly defaultBillingAccountId?: string;
  readonly merchantAccountMap: Record<string, string>;
  readonly defaultMerchantAccountId?: string;
  readonly priceMap: Record<string, string>;
  readonly defaultPriceId?: string;
};

type PaymentFieldConfigInput = {
  readonly _id: string;
  readonly fieldId: string;
  readonly documentId: string;
  readonly organizationId: string;
  readonly paymentType:
    | "one_time"
    | "recurring"
    | "installments"
    | "deposit_balance";
  readonly items: readonly {
    readonly id: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
  readonly currency: string;
  readonly dueDateTerms:
    | "on_receipt"
    | "net_15"
    | "net_30"
    | "net_60"
    | "custom";
  readonly customDueDays?: number;
  readonly customDueDate?: string;
  readonly totalAmountCents: number;
  readonly feeHandling: "absorb" | "pass_to_recipient";
  readonly taxEnabled: boolean;
  readonly taxBehavior?: TaxBehavior;
  readonly recurringConfig?: {
    readonly interval: "week" | "month" | "year";
    readonly intervalCount: number;
    readonly endCondition: "never" | "after_count" | "on_date";
    readonly endAfterCount?: number;
    readonly endOnDate?: number;
  };
  readonly installmentsConfig?: {
    readonly count: number;
    readonly interval: "week" | "month";
    readonly firstPaymentAmount?: number;
  };
  readonly depositBalanceConfig?: {
    readonly depositPercent: number;
    readonly balanceDueDays: number;
  };
};

type PaymentRecipient = {
  readonly email: string;
  readonly name: string | undefined;
};

type FeePolicyOwnerMode =
  | "merchant_pays_processing"
  | "customer_pays_processing"
  | "platform_absorbs_processing"
  | "platform_fee_deducted";

type PlatformFee =
  | {
      readonly mode: "none";
    }
  | {
      readonly mode: "fixed_amount";
      readonly amount: number;
      readonly currency: VortexCurrency;
      readonly rounding: "half_up";
    };

type FeePolicy = {
  readonly policyId: string;
  readonly ownerMode: FeePolicyOwnerMode;
  readonly platformFee: PlatformFee;
  readonly source: {
    readonly scope: "document_payment_field";
    readonly scopeId: string;
  };
  readonly audit: {
    readonly createdByType: "adopter";
    readonly createdByRef: string;
    readonly reason: string;
  };
  readonly execution: {
    readonly status: "modeled_not_settlement_executed";
    readonly stopCondition: string;
  };
  readonly evidence: readonly string[];
};

export type CreatePayableRequest = {
  readonly sourceType: "document_payment_field";
  readonly sourceId: string;
  readonly documentId: string;
  readonly paymentFieldId: string;
  readonly customerExternalId: string;
  readonly billingAccountId: string;
  readonly collectionIntent: "manual";
  readonly feePolicy: FeePolicy;
  readonly dueAt?: string;
  readonly lineItems: readonly JsonObject[];
  readonly taxable?: boolean;
  readonly taxBehavior?: TaxBehavior;
  readonly taxClassificationKey?: TaxClassificationKey;
  readonly metadata: Record<string, string>;
};

type CreatePayableResult = {
  readonly payableId: string;
  readonly paymentRequestId: string | undefined;
  readonly checkoutUrl: string | undefined;
};

type VortexCurrency = "USD" | "CAD";
type TaxBehavior = "inclusive" | "exclusive";
type TaxClassificationKey = "standard_taxable";
type VortexTaxMode = "not_taxable" | "taxable_requires_evidence";

type RecurringEndPolicy =
  | {
      readonly mode: "never";
    }
  | {
      readonly mode: "after_count";
      readonly cycleCount: number;
    }
  | {
      readonly mode: "on_date";
      readonly endAt: string;
    };

export type CreateRecurringPayableRequest = {
  readonly sourceType: "document_payment_field";
  readonly sourceId: string;
  readonly documentId: string;
  readonly paymentFieldId: string;
  readonly customerExternalId: string;
  readonly billingAccountId: string;
  readonly merchantAccountId?: string;
  readonly currency: VortexCurrency;
  readonly lineItems: readonly JsonObject[];
  readonly taxMode: VortexTaxMode;
  readonly taxable?: boolean;
  readonly taxBehavior?: TaxBehavior;
  readonly taxClassificationKey?: TaxClassificationKey;
  readonly collectionIntent: "manual";
  readonly feePolicy: FeePolicy;
  readonly cadence: {
    readonly interval: "week" | "month" | "year";
    readonly intervalCount: number;
  };
  readonly endPolicy: RecurringEndPolicy;
  readonly startAt: string;
  readonly metadata: Record<string, string>;
};

type CreateRecurringPayableResult = {
  readonly recurringPayableId: string;
  readonly payableId: string;
  readonly paymentRequestId: string | undefined;
  readonly checkoutUrl: string | undefined;
};

type InstallmentPlanItem = {
  readonly installmentNumber: number;
  readonly role: "installment";
  readonly dueAt: string;
  readonly amountDue: number;
  readonly lineItems: readonly JsonObject[];
};

export type CreateInstallmentPayableRequest = {
  readonly sourceType: "document_payment_field";
  readonly sourceId: string;
  readonly documentId: string;
  readonly paymentFieldId: string;
  readonly customerExternalId: string;
  readonly billingAccountId: string;
  readonly merchantAccountId?: string;
  readonly currency: VortexCurrency;
  readonly taxMode: VortexTaxMode;
  readonly taxable?: boolean;
  readonly taxBehavior?: TaxBehavior;
  readonly taxClassificationKey?: TaxClassificationKey;
  readonly collectionIntent: "manual";
  readonly feePolicy: FeePolicy;
  readonly installments: readonly InstallmentPlanItem[];
  readonly metadata: Record<string, string>;
};

type CreateInstallmentPayableResult = {
  readonly installmentPayableId: string;
  readonly payableId: string;
  readonly paymentRequestId: string | undefined;
  readonly checkoutUrl: string | undefined;
};

type DepositBalancePart = {
  readonly dueAt: string;
  readonly amountDue: number;
  readonly lineItems: readonly JsonObject[];
};

export type CreateDepositBalancePayableRequest = {
  readonly sourceType: "document_payment_field";
  readonly sourceId: string;
  readonly documentId: string;
  readonly paymentFieldId: string;
  readonly customerExternalId: string;
  readonly billingAccountId: string;
  readonly merchantAccountId?: string;
  readonly currency: VortexCurrency;
  readonly taxMode: VortexTaxMode;
  readonly taxable?: boolean;
  readonly taxBehavior?: TaxBehavior;
  readonly taxClassificationKey?: TaxClassificationKey;
  readonly collectionIntent: "manual";
  readonly feePolicy: FeePolicy;
  readonly deposit: DepositBalancePart;
  readonly balance: DepositBalancePart;
  readonly metadata: Record<string, string>;
};

type CreateDepositBalancePayableResult = {
  readonly depositBalancePayableId: string;
  readonly payableId: string;
  readonly paymentRequestId: string | undefined;
  readonly checkoutUrl: string | undefined;
};

const API_BASE_URL_ENV = "VORTEX_BILLING_API_BASE_URL";
const API_KEY_ENV = "VORTEX_BILLING_API_KEY";
const SOURCE_NAMESPACE_ENV = "VORTEX_BILLING_SOURCE_NAMESPACE";
const DOCUMENT_CUSTOMER_MAP_ENV = "VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP";
const SHARED_CUSTOMER_MAP_ENV = "VORTEX_BILLING_CUSTOMER_MAP";
const DOCUMENT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP";
const SHARED_ACCOUNT_MAP_ENV = "VORTEX_BILLING_ACCOUNT_MAP";
const DOCUMENT_DEFAULT_ACCOUNT_ID_ENV = "VORTEX_BILLING_DOCUMENT_ACCOUNT_ID";
const SHARED_ACCOUNT_ID_ENV = "VORTEX_BILLING_ACCOUNT_ID";
const DOCUMENT_MERCHANT_ACCOUNT_MAP_ENV =
  "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP";
const SHARED_MERCHANT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_MERCHANT_ACCOUNT_MAP";
const DOCUMENT_DEFAULT_MERCHANT_ACCOUNT_ID_ENV =
  "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_ID";
const SHARED_MERCHANT_ACCOUNT_ID_ENV = "VORTEX_BILLING_MERCHANT_ACCOUNT_ID";
const DOCUMENT_PRICE_MAP_ENV = "VORTEX_BILLING_DOCUMENT_PRICE_MAP";
const SHARED_PRICE_MAP_ENV = "VORTEX_BILLING_PRICE_MAP";
const DOCUMENT_DEFAULT_PRICE_ID_ENV = "VORTEX_BILLING_DOCUMENT_PRICE_ID";
const SHARED_PRICE_ID_ENV = "VORTEX_BILLING_PRICE_ID";
const PAYMENTS_ENVIRONMENT_ENV = "VORTEX_BILLING_PAYMENTS_ENVIRONMENT";

export function selectDocumentPaymentProvider(
  _organizationId: string,
  _configs: readonly Pick<
    PaymentFieldConfigInput,
    "paymentType" | "taxEnabled"
  >[],
  _env: Env = process.env
): DocumentPaymentProvider {
  return "vortex_billing";
}

export function readVortexBillingEnv(
  input: VortexBillingEnvInput
): VortexBillingEnv {
  const customerMap = parseOptionalStringRecord(
    input.customerMapJson,
    "customerMapJson"
  );
  const billingAccountMap = parseOptionalStringRecord(
    input.billingAccountMapJson,
    "billingAccountMapJson"
  );
  const merchantAccountMap = parseOptionalStringRecord(
    input.merchantAccountMapJson,
    "merchantAccountMapJson"
  );
  const priceMap = parseOptionalStringRecord(
    input.priceMapJson,
    "priceMapJson"
  );

  return {
    apiBaseUrl: readRequiredValue(input.apiBaseUrl, "apiBaseUrl"),
    apiKey: readRequiredValue(input.apiKey, "apiKey"),
    sourceNamespace: input.sourceNamespace ?? "seal",
    paymentsEnvironment: input.paymentsEnvironment ?? "sandbox",
    customerMap,
    billingAccountMap,
    defaultBillingAccountId: input.defaultBillingAccountId,
    merchantAccountMap,
    defaultMerchantAccountId: input.defaultMerchantAccountId,
    priceMap,
    defaultPriceId: input.defaultPriceId,
  };
}

export function readVortexBillingEnvFromProcess(
  env: Env = process.env
): VortexBillingEnv {
  return readVortexBillingEnv({
    apiBaseUrl: env[API_BASE_URL_ENV],
    apiKey: env[API_KEY_ENV],
    sourceNamespace: env[SOURCE_NAMESPACE_ENV] ?? "seal",
    customerMapJson:
      env[DOCUMENT_CUSTOMER_MAP_ENV] ?? env[SHARED_CUSTOMER_MAP_ENV],
    billingAccountMapJson:
      env[DOCUMENT_ACCOUNT_MAP_ENV] ?? env[SHARED_ACCOUNT_MAP_ENV],
    defaultBillingAccountId:
      env[DOCUMENT_DEFAULT_ACCOUNT_ID_ENV] ?? env[SHARED_ACCOUNT_ID_ENV],
    merchantAccountMapJson:
      env[DOCUMENT_MERCHANT_ACCOUNT_MAP_ENV] ??
      env[SHARED_MERCHANT_ACCOUNT_MAP_ENV],
    defaultMerchantAccountId:
      env[DOCUMENT_DEFAULT_MERCHANT_ACCOUNT_ID_ENV] ??
      env[SHARED_MERCHANT_ACCOUNT_ID_ENV],
    paymentsEnvironment: env[PAYMENTS_ENVIRONMENT_ENV] ?? "sandbox",
    priceMapJson: env[DOCUMENT_PRICE_MAP_ENV] ?? env[SHARED_PRICE_MAP_ENV],
    defaultPriceId:
      env[DOCUMENT_DEFAULT_PRICE_ID_ENV] ?? env[SHARED_PRICE_ID_ENV],
  });
}

export function buildCreatePayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
  readonly vortexMerchantAccountId?: string;
  readonly platformFeeCents?: number;
}): CreatePayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "one_time") {
    throw new ConvexError(
      "Vortex Billing document bridge only supports one-time payments"
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }

  const organizationKey = String(config.organizationId);
  const customerExternalId =
    env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(
      `Vortex Billing customer missing for recipient: ${recipient.email}`
    );
  }

  const billingAccountId =
    env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(
      `Vortex Billing account missing for organization: ${organizationKey}`
    );
  }

  const merchantAccountId = resolveVortexMerchantAccountId(
    organizationKey,
    env,
    input.vortexMerchantAccountId
  );
  const sourceId = String(config._id);
  const dueAt = getDueAt(config, now);

  return {
    sourceType: "document_payment_field",
    sourceId,
    documentId: String(config.documentId),
    paymentFieldId: String(config.fieldId),
    customerExternalId,
    billingAccountId,
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config, input.platformFeeCents),
    ...(dueAt !== undefined ? { dueAt } : {}),
    lineItems: config.items.map((item) =>
      buildPayableLineItem(item, env.priceMap, env.defaultPriceId)
    ),
    ...buildPayableTaxFields(config),
    metadata: {
      sourceSystem: env.sourceNamespace,
      vortexPaymentsEnvironment: env.paymentsEnvironment,
      sealOrganizationId: organizationKey,
      sealDocumentId: String(config.documentId),
      sealPaymentFieldId: String(config.fieldId),
      sealPaymentConfigId: sourceId,
      recipientEmail: recipient.email,
      ...(recipient.name !== undefined
        ? { recipientName: recipient.name }
        : {}),
      ...(merchantAccountId.length > 0
        ? { vortexMerchantAccountId: merchantAccountId }
        : {}),
    },
  };
}

export function buildCreateRecurringPayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
  readonly vortexMerchantAccountId?: string;
  readonly platformFeeCents?: number;
}): CreateRecurringPayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "recurring") {
    throw new ConvexError(
      "Vortex Billing recurring document bridge requires recurring payments"
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (config.recurringConfig === undefined) {
    throw new ConvexError(
      "Recurring payment field is missing recurring configuration"
    );
  }
  if (config.recurringConfig.intervalCount <= 0) {
    throw new ConvexError(
      "Recurring payment interval count must be greater than zero"
    );
  }

  const organizationKey = String(config.organizationId);
  const customerExternalId =
    env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(
      `Vortex Billing customer missing for recipient: ${recipient.email}`
    );
  }

  const billingAccountId =
    env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(
      `Vortex Billing account missing for organization: ${organizationKey}`
    );
  }

  const merchantAccountId = resolveVortexMerchantAccountId(
    organizationKey,
    env,
    input.vortexMerchantAccountId
  );
  const sourceId = String(config._id);

  return {
    sourceType: "document_payment_field",
    sourceId,
    documentId: String(config.documentId),
    paymentFieldId: String(config.fieldId),
    customerExternalId,
    billingAccountId,
    ...(merchantAccountId.length > 0 ? { merchantAccountId } : {}),
    currency: toVortexCurrency(config.currency),
    lineItems: config.items.map((item) =>
      buildPayableLineItem(item, env.priceMap, env.defaultPriceId)
    ),
    taxMode: buildPayableTaxMode(config),
    ...buildPayableTaxFields(config),
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config, input.platformFeeCents),
    cadence: {
      interval: config.recurringConfig.interval,
      intervalCount: config.recurringConfig.intervalCount,
    },
    endPolicy: buildRecurringEndPolicy(config.recurringConfig),
    startAt: new Date(now).toISOString(),
    metadata: {
      sourceSystem: env.sourceNamespace,
      vortexPaymentsEnvironment: env.paymentsEnvironment,
      sealOrganizationId: organizationKey,
      sealDocumentId: String(config.documentId),
      sealPaymentFieldId: String(config.fieldId),
      sealPaymentConfigId: sourceId,
      sealPaymentType: config.paymentType,
      recipientEmail: recipient.email,
      ...(recipient.name !== undefined
        ? { recipientName: recipient.name }
        : {}),
      ...(merchantAccountId.length > 0
        ? { vortexMerchantAccountId: merchantAccountId }
        : {}),
    },
  };
}

export function buildCreateInstallmentPayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
  readonly vortexMerchantAccountId?: string;
  readonly platformFeeCents?: number;
}): CreateInstallmentPayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "installments") {
    throw new ConvexError(
      "Vortex Billing installment document bridge requires installments"
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (config.installmentsConfig === undefined) {
    throw new ConvexError(
      "Installment payment field is missing installment configuration"
    );
  }
  const installmentsConfig = config.installmentsConfig;

  const organizationKey = String(config.organizationId);
  const customerExternalId =
    env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(
      `Vortex Billing customer missing for recipient: ${recipient.email}`
    );
  }

  const billingAccountId =
    env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(
      `Vortex Billing account missing for organization: ${organizationKey}`
    );
  }

  const merchantAccountId = resolveVortexMerchantAccountId(
    organizationKey,
    env,
    input.vortexMerchantAccountId
  );
  const sourceId = String(config._id);
  const firstDueAt = getDueAt(config, now) ?? new Date(now).toISOString();
  const amounts = buildInstallmentAmounts(
    config.totalAmountCents,
    installmentsConfig
  );

  return {
    sourceType: "document_payment_field",
    sourceId,
    documentId: String(config.documentId),
    paymentFieldId: String(config.fieldId),
    customerExternalId,
    billingAccountId,
    ...(merchantAccountId.length > 0 ? { merchantAccountId } : {}),
    currency: toVortexCurrency(config.currency),
    taxMode: buildPayableTaxMode(config),
    ...buildPayableTaxFields(config),
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config, input.platformFeeCents),
    installments: amounts.map((amountDue, index) => ({
      installmentNumber: index + 1,
      role: "installment",
      dueAt: addInstallmentInterval(
        firstDueAt,
        installmentsConfig.interval,
        index
      ),
      amountDue,
      lineItems: buildInstallmentLineItems(
        config,
        amountDue,
        env.priceMap,
        env.defaultPriceId
      ),
    })),
    metadata: {
      sourceSystem: env.sourceNamespace,
      vortexPaymentsEnvironment: env.paymentsEnvironment,
      sealOrganizationId: organizationKey,
      sealDocumentId: String(config.documentId),
      sealPaymentFieldId: String(config.fieldId),
      sealPaymentConfigId: sourceId,
      sealPaymentType: config.paymentType,
      recipientEmail: recipient.email,
      ...(recipient.name !== undefined
        ? { recipientName: recipient.name }
        : {}),
      ...(merchantAccountId.length > 0
        ? { vortexMerchantAccountId: merchantAccountId }
        : {}),
    },
  };
}

export function buildCreateDepositBalancePayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
  readonly vortexMerchantAccountId?: string;
  readonly platformFeeCents?: number;
}): CreateDepositBalancePayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "deposit_balance") {
    throw new ConvexError(
      "Vortex Billing deposit/balance document bridge requires deposit_balance payments"
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (config.depositBalanceConfig === undefined) {
    throw new ConvexError(
      "Deposit/balance payment field is missing deposit balance configuration"
    );
  }

  const organizationKey = String(config.organizationId);
  const customerExternalId =
    env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(
      `Vortex Billing customer missing for recipient: ${recipient.email}`
    );
  }

  const billingAccountId =
    env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(
      `Vortex Billing account missing for organization: ${organizationKey}`
    );
  }

  const merchantAccountId = resolveVortexMerchantAccountId(
    organizationKey,
    env,
    input.vortexMerchantAccountId
  );
  const sourceId = String(config._id);
  const depositDueAt = getDueAt(config, now) ?? new Date(now).toISOString();
  const amounts = buildDepositBalanceAmounts(
    config.totalAmountCents,
    config.depositBalanceConfig
  );
  const balanceDueAt = addDepositBalanceDays(
    depositDueAt,
    config.depositBalanceConfig.balanceDueDays
  );

  return {
    sourceType: "document_payment_field",
    sourceId,
    documentId: String(config.documentId),
    paymentFieldId: String(config.fieldId),
    customerExternalId,
    billingAccountId,
    ...(merchantAccountId.length > 0 ? { merchantAccountId } : {}),
    currency: toVortexCurrency(config.currency),
    taxMode: buildPayableTaxMode(config),
    ...buildPayableTaxFields(config),
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config, input.platformFeeCents),
    deposit: {
      dueAt: depositDueAt,
      amountDue: amounts.depositAmountDue,
      lineItems: buildDepositBalanceLineItems(
        config,
        "deposit",
        amounts.depositAmountDue,
        env.priceMap,
        env.defaultPriceId
      ),
    },
    balance: {
      dueAt: balanceDueAt,
      amountDue: amounts.balanceAmountDue,
      lineItems: buildDepositBalanceLineItems(
        config,
        "balance",
        amounts.balanceAmountDue,
        env.priceMap,
        env.defaultPriceId
      ),
    },
    metadata: {
      sourceSystem: env.sourceNamespace,
      vortexPaymentsEnvironment: env.paymentsEnvironment,
      sealOrganizationId: organizationKey,
      sealDocumentId: String(config.documentId),
      sealPaymentFieldId: String(config.fieldId),
      sealPaymentConfigId: sourceId,
      sealPaymentType: config.paymentType,
      recipientEmail: recipient.email,
      ...(recipient.name !== undefined
        ? { recipientName: recipient.name }
        : {}),
      ...(merchantAccountId.length > 0
        ? { vortexMerchantAccountId: merchantAccountId }
        : {}),
    },
  };
}

function buildPayableTaxMode(config: PaymentFieldConfigInput): VortexTaxMode {
  return config.taxEnabled ? "taxable_requires_evidence" : "not_taxable";
}

function buildPayableTaxFields(config: PaymentFieldConfigInput):
  | {
      readonly taxable: true;
      readonly taxBehavior: TaxBehavior;
      readonly taxClassificationKey: TaxClassificationKey;
    }
  | Record<string, never> {
  if (!config.taxEnabled) {
    return {};
  }
  return {
    taxable: true,
    taxBehavior: config.taxBehavior ?? "exclusive",
    taxClassificationKey: "standard_taxable",
  };
}

function buildPayableLineItem(
  item: PaymentFieldConfigInput["items"][number],
  priceMap: Record<string, string>,
  defaultPriceId: string | undefined
): JsonObject {
  const priceId = priceMap[item.id] ?? defaultPriceId;
  if (!priceId) {
    throw new ConvexError(
      `Vortex Billing price missing for payment item: ${item.id}`
    );
  }

  return {
    priceId,
    quantity: item.quantity,
    taxable: false,
    metadata: {
      sealLineItemId: item.id,
      sealLineItemDescription: item.description,
      sealLineItemUnitPrice: String(item.unitPrice),
    },
  };
}

function buildInstallmentLineItems(
  config: Pick<PaymentFieldConfigInput, "items">,
  amountDue: number,
  priceMap: Record<string, string>,
  defaultPriceId: string | undefined
): readonly JsonObject[] {
  if (config.items.length !== 1) {
    throw new ConvexError(
      "Vortex Billing installment bridge requires exactly one line item"
    );
  }
  const item = config.items[0];
  if (item === undefined) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (!Number.isInteger(item.unitPrice) || item.unitPrice <= 0) {
    throw new ConvexError(
      "Installment line item unit price must be a positive integer"
    );
  }
  if (amountDue % item.unitPrice !== 0) {
    throw new ConvexError(
      "Installment amount must divide evenly into the configured line item"
    );
  }

  return [
    buildPayableLineItem(
      { ...item, quantity: amountDue / item.unitPrice },
      priceMap,
      defaultPriceId
    ),
  ];
}

function buildDepositBalanceLineItems(
  config: Pick<PaymentFieldConfigInput, "items">,
  role: "deposit" | "balance",
  amountDue: number,
  priceMap: Record<string, string>,
  defaultPriceId: string | undefined
): readonly JsonObject[] {
  if (config.items.length !== 1) {
    throw new ConvexError(
      "Vortex Billing deposit/balance bridge requires exactly one line item"
    );
  }
  const item = config.items[0];
  if (item === undefined) {
    throw new ConvexError("Payment field has no line items configured");
  }

  return [
    buildPayableLineItem(
      {
        ...item,
        id: `${item.id}:${role}`,
        description: `${item.description} (${role})`,
        quantity: 1,
        unitPrice: amountDue,
      },
      priceMap,
      defaultPriceId
    ),
  ];
}

function buildDepositBalanceAmounts(
  totalAmountCents: number,
  config: NonNullable<PaymentFieldConfigInput["depositBalanceConfig"]>
): { readonly depositAmountDue: number; readonly balanceAmountDue: number } {
  if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
    throw new ConvexError(
      "Deposit/balance total amount must be a positive integer"
    );
  }
  if (config.depositPercent <= 0 || config.depositPercent >= 100) {
    throw new ConvexError(
      "Deposit percent must be greater than 0 and less than 100"
    );
  }
  if (!Number.isInteger(config.balanceDueDays) || config.balanceDueDays < 1) {
    throw new ConvexError("Deposit/balance due days must be at least one");
  }

  const total = money(totalAmountCents, PAYABLE_CURRENCY);
  const depositAmountDue = applyRate(
    total,
    config.depositPercent / 100,
    MONEY_ROUNDING
  ).amount;
  const balanceAmountDue = subtractMoney(
    total,
    money(depositAmountDue, PAYABLE_CURRENCY)
  ).amount;
  if (depositAmountDue <= 0 || balanceAmountDue <= 0) {
    throw new ConvexError(
      "Deposit and balance amounts must both be greater than zero"
    );
  }

  return { depositAmountDue, balanceAmountDue };
}

function getInitialVortexChargeAmountCents(
  config: PaymentFieldConfigInput
): number {
  if (config.paymentType === "installments") {
    if (config.installmentsConfig === undefined) {
      throw new ConvexError(
        "Installment payment field is missing installment configuration"
      );
    }
    const firstInstallment = buildInstallmentAmounts(
      config.totalAmountCents,
      config.installmentsConfig
    )[0];
    if (firstInstallment === undefined) {
      throw new ConvexError(
        "Installment payment field did not produce a first charge amount"
      );
    }
    return firstInstallment;
  }
  if (config.paymentType === "deposit_balance") {
    if (config.depositBalanceConfig === undefined) {
      throw new ConvexError(
        "Deposit/balance payment field is missing deposit balance configuration"
      );
    }
    return buildDepositBalanceAmounts(
      config.totalAmountCents,
      config.depositBalanceConfig
    ).depositAmountDue;
  }
  return config.totalAmountCents;
}

function addDepositBalanceDays(
  firstDueAt: string,
  balanceDueDays: number
): string {
  const firstDueTime = new Date(firstDueAt).getTime();
  if (Number.isNaN(firstDueTime)) {
    throw new ConvexError("Deposit due date is invalid");
  }
  return new Date(
    firstDueTime + balanceDueDays * 24 * 60 * 60 * 1000
  ).toISOString();
}

function buildInstallmentAmounts(
  totalAmountCents: number,
  config: NonNullable<PaymentFieldConfigInput["installmentsConfig"]>
): readonly number[] {
  if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
    throw new ConvexError(
      "Installment total amount must be a positive integer"
    );
  }
  if (!Number.isInteger(config.count) || config.count < 2) {
    throw new ConvexError("Installment count must be at least two");
  }
  if (config.firstPaymentAmount !== undefined) {
    if (
      !Number.isInteger(config.firstPaymentAmount) ||
      config.firstPaymentAmount <= 0
    ) {
      throw new ConvexError(
        "Installment first payment amount must be a positive integer"
      );
    }
    if (config.firstPaymentAmount >= totalAmountCents) {
      throw new ConvexError(
        "Installment first payment amount must be less than the total"
      );
    }
    return [
      config.firstPaymentAmount,
      ...splitInstallmentAmount(
        totalAmountCents - config.firstPaymentAmount,
        config.count - 1
      ),
    ];
  }

  return splitInstallmentAmount(totalAmountCents, config.count);
}

function splitInstallmentAmount(
  totalAmountCents: number,
  count: number
): readonly number[] {
  const parts = allocate(
    money(totalAmountCents, PAYABLE_CURRENCY),
    Array.from({ length: count }, () => 1)
  ).map((part) => part.amount);
  if (parts.some((amount) => amount <= 0)) {
    throw new ConvexError("Installment amount must be greater than zero");
  }

  return parts;
}

function addInstallmentInterval(
  firstDueAt: string,
  interval: NonNullable<
    PaymentFieldConfigInput["installmentsConfig"]
  >["interval"],
  offset: number
): string {
  const firstDueTime = new Date(firstDueAt).getTime();
  if (Number.isNaN(firstDueTime)) {
    throw new ConvexError("Installment first due date is invalid");
  }
  const days = interval === "week" ? 7 * offset : 30 * offset;
  return new Date(firstDueTime + days * 24 * 60 * 60 * 1000).toISOString();
}

function buildRecurringEndPolicy(
  config: NonNullable<PaymentFieldConfigInput["recurringConfig"]>
): RecurringEndPolicy {
  switch (config.endCondition) {
    case "never":
      return { mode: "never" };
    case "after_count":
      if (config.endAfterCount === undefined || config.endAfterCount <= 0) {
        throw new ConvexError(
          "Recurring payment end-after count must be greater than zero"
        );
      }
      return {
        mode: "after_count",
        cycleCount: config.endAfterCount,
      };
    case "on_date":
      if (config.endOnDate === undefined) {
        throw new ConvexError("Recurring payment end date is required");
      }
      return {
        mode: "on_date",
        endAt: new Date(config.endOnDate).toISOString(),
      };
  }
}

function toVortexCurrency(currency: string): VortexCurrency {
  const normalized = currency.toUpperCase();
  if (normalized === "USD" || normalized === "CAD") {
    return normalized;
  }
  throw new ConvexError(
    "Vortex Billing document bridge only supports USD and CAD"
  );
}

function resolveVortexMerchantAccountId(
  organizationKey: string,
  env: VortexBillingEnv,
  vortexMerchantAccountId: string | undefined
): string {
  return (
    vortexMerchantAccountId ??
    env.merchantAccountMap[organizationKey] ??
    env.defaultMerchantAccountId ??
    ""
  );
}

function buildFeePolicy(
  config: Pick<PaymentFieldConfigInput, "_id" | "feeHandling" | "currency">,
  platformFeeCents?: number
): FeePolicy {
  const ownerMode: FeePolicyOwnerMode =
    config.feeHandling === "pass_to_recipient"
      ? "customer_pays_processing"
      : "merchant_pays_processing";
  const sourceId = String(config._id);
  const platformFee: PlatformFee =
    platformFeeCents !== undefined && platformFeeCents > 0
      ? {
          mode: "fixed_amount",
          amount: platformFeeCents,
          currency: toVortexCurrency(config.currency),
          rounding: "half_up",
        }
      : { mode: "none" };
  const platformFeeEvidence =
    platformFee.mode === "fixed_amount"
      ? `platform_fee:fixed_amount:${platformFee.amount}:${platformFee.currency}:${platformFee.rounding}`
      : "platform_fee:none";

  return {
    policyId: `seal_document_payment_${normalizeExternalIdPart(sourceId)}`,
    ownerMode,
    platformFee,
    source: {
      scope: "document_payment_field",
      scopeId: sourceId,
    },
    audit: {
      createdByType: "adopter",
      createdByRef: "seal-document-payment-field",
      reason: "Seal document payment fee handling",
    },
    execution: {
      status: "modeled_not_settlement_executed",
      stopCondition:
        platformFee.mode === "fixed_amount"
          ? "fixed application fee is modeled for Vortex payable creation; Vortex executes it on card charge"
          : "fee policy is modeled for Vortex payable creation; no platform fee is requested",
    },
    evidence: [
      `source:document_payment_field:${sourceId}`,
      `fee_owner:${ownerMode}`,
      platformFeeEvidence,
      `seal_fee_handling:${config.feeHandling}`,
    ],
  };
}

function getDueAt(
  config: Pick<
    PaymentFieldConfigInput,
    "dueDateTerms" | "customDueDays" | "customDueDate"
  >,
  now: number
): string | undefined {
  if (
    config.customDueDate !== undefined &&
    config.customDueDate.trim().length > 0
  ) {
    const dueAt = new Date(config.customDueDate);
    if (Number.isNaN(dueAt.getTime())) {
      throw new ConvexError("Payment field custom due date is invalid");
    }
    return dueAt.toISOString();
  }

  const dueDays = getDueDays(config.dueDateTerms, config.customDueDays);
  return new Date(now + dueDays * 24 * 60 * 60 * 1000).toISOString();
}

function getDueDays(
  terms: PaymentFieldConfigInput["dueDateTerms"],
  customDueDays?: number
): number {
  switch (terms) {
    case "on_receipt":
      return 0;
    case "net_15":
      return 15;
    case "net_30":
      return 30;
    case "net_60":
      return 60;
    case "custom":
      return customDueDays ?? 30;
  }
}

function resolvePaymentFieldRecipient(
  config: Doc<"payment_field_configs">,
  fieldMap: Map<string, Doc<"signature_fields">>,
  recipientMap: Map<string, Doc<"document_recipients">>
): PaymentRecipient {
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }

  const field = fieldMap.get(config.fieldId.toString());
  if (!field) {
    throw new ConvexError("Payment field not found");
  }
  if (!field.recipientId) {
    throw new ConvexError(
      "Payment field must be assigned to a recipient before processing"
    );
  }

  const recipient = recipientMap.get(field.recipientId.toString());
  if (!recipient) {
    throw new ConvexError("Recipient for payment field not found");
  }

  return {
    email: recipient.email,
    name: recipient.name ?? undefined,
  };
}

async function createVortexPayable(
  request: CreatePayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string
): Promise<CreatePayableResult> {
  const client = createVortexBillingClient({
    apiBaseUrl: env.apiBaseUrl,
    apiKey: env.apiKey,
  });
  const { data, error, response } = await createPayable({
    client,
    headers: { "Idempotency-Key": idempotencyKey },
    body: request as unknown as Parameters<typeof createPayable>[0]["body"],
  });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing payable create failed (${response?.status ?? "no-response"})`
    );
  }
  return readCreatePayableResult(data);
}

async function createVortexRecurringPayable(
  request: CreateRecurringPayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string
): Promise<CreateRecurringPayableResult> {
  const client = createVortexBillingClient({
    apiBaseUrl: env.apiBaseUrl,
    apiKey: env.apiKey,
  });
  const { data, error, response } = await createRecurringPayable({
    client,
    headers: { "Idempotency-Key": idempotencyKey },
    body: request as unknown as Parameters<
      typeof createRecurringPayable
    >[0]["body"],
  });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing recurring payable create failed (${response?.status ?? "no-response"})`
    );
  }
  return readCreateRecurringPayableResult(data);
}

async function createVortexInstallmentPayable(
  request: CreateInstallmentPayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string
): Promise<CreateInstallmentPayableResult> {
  const client = createVortexBillingClient({
    apiBaseUrl: env.apiBaseUrl,
    apiKey: env.apiKey,
  });
  const { data, error, response } = await createInstallmentPayable({
    client,
    headers: { "Idempotency-Key": idempotencyKey },
    body: request as unknown as Parameters<
      typeof createInstallmentPayable
    >[0]["body"],
  });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing installment payable create failed (${response?.status ?? "no-response"})`
    );
  }
  return readCreateInstallmentPayableResult(data);
}

async function createVortexDepositBalancePayable(
  request: CreateDepositBalancePayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string
): Promise<CreateDepositBalancePayableResult> {
  const client = createVortexBillingClient({
    apiBaseUrl: env.apiBaseUrl,
    apiKey: env.apiKey,
  });
  const { data, error, response } = await createDepositBalancePayable({
    client,
    headers: { "Idempotency-Key": idempotencyKey },
    body: request as unknown as Parameters<
      typeof createDepositBalancePayable
    >[0]["body"],
  });
  if (error !== undefined || response === undefined || !response.ok) {
    throw new ConvexError(
      `Vortex Billing deposit-balance payable create failed (${response?.status ?? "no-response"})`
    );
  }
  return readCreateDepositBalancePayableResult(data);
}

function readCreatePayableResult(body: unknown): CreatePayableResult {
  const root = readObject(body, "Vortex Billing payable response");
  const data = readObject(root.data, "Vortex Billing payable response data");
  const payable = readObject(
    data.payable,
    "Vortex Billing payable response payable"
  );
  const lineage = readObject(
    payable.lineage,
    "Vortex Billing payable response lineage"
  );
  const payableId = readString(payable.payableId, "Vortex Billing payable id");
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing payment request id"
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing checkout URL"
  );

  return {
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

function readCreateRecurringPayableResult(
  body: unknown
): CreateRecurringPayableResult {
  const root = readObject(body, "Vortex Billing recurring payable response");
  const data = readObject(
    root.data,
    "Vortex Billing recurring payable response data"
  );
  const recurringPayable = readObject(
    data.recurringPayable,
    "Vortex Billing recurring payable response recurring payable"
  );
  const payable = readObject(
    data.payable,
    "Vortex Billing recurring payable response payable"
  );
  const lineage = readObject(
    payable.lineage,
    "Vortex Billing recurring payable response lineage"
  );
  const recurringPayableId = readString(
    recurringPayable.recurringPayableId,
    "Vortex Billing recurring payable id"
  );
  const payableId = readString(
    payable.payableId,
    "Vortex Billing recurring cycle payable id"
  );
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing recurring cycle payment request id"
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing recurring cycle checkout URL"
  );

  return {
    recurringPayableId,
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

function readCreateInstallmentPayableResult(
  body: unknown
): CreateInstallmentPayableResult {
  const root = readObject(body, "Vortex Billing installment payable response");
  const data = readObject(
    root.data,
    "Vortex Billing installment payable response data"
  );
  const installmentPayable = readObject(
    data.installmentPayable,
    "Vortex Billing installment payable response installment payable"
  );
  const payable = readObject(
    data.payable,
    "Vortex Billing installment payable response payable"
  );
  const lineage = readObject(
    payable.lineage,
    "Vortex Billing installment payable response lineage"
  );
  const installmentPayableId = readString(
    installmentPayable.installmentPayableId,
    "Vortex Billing installment payable id"
  );
  const payableId = readString(
    payable.payableId,
    "Vortex Billing first installment payable id"
  );
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing first installment payment request id"
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing first installment checkout URL"
  );

  return {
    installmentPayableId,
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

function readCreateDepositBalancePayableResult(
  body: unknown
): CreateDepositBalancePayableResult {
  const root = readObject(
    body,
    "Vortex Billing deposit/balance payable response"
  );
  const data = readObject(
    root.data,
    "Vortex Billing deposit/balance payable response data"
  );
  const depositBalancePayable = readObject(
    data.depositBalancePayable,
    "Vortex Billing deposit/balance payable response deposit balance payable"
  );
  const payable = readObject(
    data.payable,
    "Vortex Billing deposit/balance payable response payable"
  );
  const lineage = readObject(
    payable.lineage,
    "Vortex Billing deposit/balance payable response lineage"
  );
  // Vortex models a deposit/balance payable on top of the installment payable object, so its id
  // field is literally `installmentPayableId` (not a copy-paste bug). The Vortex proof asserts
  // installmentPayableId === the deposit-balance payable id.
  const depositBalancePayableId = readString(
    depositBalancePayable.installmentPayableId,
    "Vortex Billing deposit/balance payable id"
  );
  const payableId = readString(
    payable.payableId,
    "Vortex Billing deposit payable id"
  );
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing deposit payment request id"
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing deposit checkout URL"
  );

  return {
    depositBalancePayableId,
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

export const createVortexPaymentObjectsForDocumentFields = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.object({
    paymentLinks: v.array(
      v.object({
        recipientEmail: v.string(),
        hostedInvoiceUrl: v.union(v.string(), v.null()),
        vortexPayableId: v.string(),
        totalAmountCents: v.number(),
        currency: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const configs: Doc<"payment_field_configs">[] = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId }
    );

    if (configs.length === 0) {
      return { paymentLinks: [] };
    }
    // Prefer this org's own charges-ready Vortex merchant for the payable; falls back to the
    // shared/static merchant map when the per-user merchant isn't provisioned/ready yet (1a is
    // additive — routing is unchanged; only the merchant id is per-user when available).
    const vortexMerchantAccountId = await ctx.runQuery(
      internal.payments.vortex_merchant_queries
        .getVortexMerchantAccountIdForOrg,
      { organizationId: args.organizationId }
    );

    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId }
    );
    const recipientMap = new Map(
      recipients.map((recipient) => [recipient._id.toString(), recipient])
    );

    const fields: Doc<"signature_fields">[] = await ctx.runQuery(
      internal.signature_fields.queries.getFieldsByDocumentInternal,
      { documentId: args.documentId }
    );
    const fieldMap = new Map(
      fields.map((field) => [field._id.toString(), field])
    );

    const env = readVortexBillingEnvFromProcess();
    const paymentLinks: Array<{
      recipientEmail: string;
      hostedInvoiceUrl: string | null;
      vortexPayableId: string;
      totalAmountCents: number;
      currency: string;
    }> = [];

    for (const config of configs) {
      const recipient = resolvePaymentFieldRecipient(
        config,
        fieldMap,
        recipientMap
      );
      const configInput = toPaymentFieldConfigInput(config);
      const platformFeeCents = await ctx.runQuery(
        internal.auth.subscription_helpers.getApplicationFeeForOrganization,
        {
          organizationId: args.organizationId,
          amountCents: getInitialVortexChargeAmountCents(configInput),
          isAch: false,
        }
      );
      if (configInput.paymentType === "recurring") {
        const recurringRequest = buildCreateRecurringPayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
          vortexMerchantAccountId: vortexMerchantAccountId ?? undefined,
          platformFeeCents,
        });
        const recurringPayable = await createVortexRecurringPayable(
          recurringRequest,
          env,
          `seal-document-recurring-payable:${config._id}`
        );
        if (recurringPayable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing recurring payable response did not include checkout URL"
          );
        }

        await ctx.runMutation(
          internal.payment_fields.mutations.storeVortexPayableIds,
          {
            configId: config._id,
            paymentStatus: "awaiting",
            vortexPayableId: recurringPayable.payableId,
            vortexRecurringPayableId: recurringPayable.recurringPayableId,
            vortexPaymentRequestId: recurringPayable.paymentRequestId,
            hostedInvoiceUrl: recurringPayable.checkoutUrl,
            customerEmail: recipient.email,
            customerName: recipient.name,
          }
        );

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: recurringPayable.checkoutUrl,
          vortexPayableId: recurringPayable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      } else if (configInput.paymentType === "installments") {
        const installmentRequest = buildCreateInstallmentPayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
          vortexMerchantAccountId: vortexMerchantAccountId ?? undefined,
          platformFeeCents,
        });
        const installmentPayable = await createVortexInstallmentPayable(
          installmentRequest,
          env,
          `seal-document-installment-payable:${config._id}`
        );
        if (installmentPayable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing installment payable response did not include checkout URL"
          );
        }

        await ctx.runMutation(
          internal.payment_fields.mutations.storeVortexPayableIds,
          {
            configId: config._id,
            paymentStatus: "awaiting",
            vortexPayableId: installmentPayable.payableId,
            vortexInstallmentPayableId: installmentPayable.installmentPayableId,
            vortexPaymentRequestId: installmentPayable.paymentRequestId,
            hostedInvoiceUrl: installmentPayable.checkoutUrl,
            customerEmail: recipient.email,
            customerName: recipient.name,
          }
        );

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: installmentPayable.checkoutUrl,
          vortexPayableId: installmentPayable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      } else if (configInput.paymentType === "deposit_balance") {
        const depositBalanceRequest = buildCreateDepositBalancePayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
          vortexMerchantAccountId: vortexMerchantAccountId ?? undefined,
          platformFeeCents,
        });
        const depositBalancePayable = await createVortexDepositBalancePayable(
          depositBalanceRequest,
          env,
          `seal-document-deposit-balance-payable:${config._id}`
        );
        if (depositBalancePayable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing deposit/balance payable response did not include checkout URL"
          );
        }

        await ctx.runMutation(
          internal.payment_fields.mutations.storeVortexPayableIds,
          {
            configId: config._id,
            paymentStatus: "awaiting",
            vortexPayableId: depositBalancePayable.payableId,
            vortexDepositBalancePayableId:
              depositBalancePayable.depositBalancePayableId,
            vortexPaymentRequestId: depositBalancePayable.paymentRequestId,
            hostedInvoiceUrl: depositBalancePayable.checkoutUrl,
            customerEmail: recipient.email,
            customerName: recipient.name,
          }
        );

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: depositBalancePayable.checkoutUrl,
          vortexPayableId: depositBalancePayable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      } else {
        const payableRequest = buildCreatePayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
          vortexMerchantAccountId: vortexMerchantAccountId ?? undefined,
          platformFeeCents,
        });
        const payable = await createVortexPayable(
          payableRequest,
          env,
          `seal-document-payable:${config._id}`
        );
        if (payable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing payable response did not include checkout URL"
          );
        }

        await ctx.runMutation(
          internal.payment_fields.mutations.storeVortexPayableIds,
          {
            configId: config._id,
            paymentStatus: "awaiting",
            vortexPayableId: payable.payableId,
            vortexPaymentRequestId: payable.paymentRequestId,
            hostedInvoiceUrl: payable.checkoutUrl,
            customerEmail: recipient.email,
            customerName: recipient.name,
          }
        );

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: payable.checkoutUrl,
          vortexPayableId: payable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      }
    }

    return { paymentLinks };
  },
});

function toPaymentFieldConfigInput(
  config: Doc<"payment_field_configs">
): PaymentFieldConfigInput {
  return {
    _id: config._id,
    fieldId: config.fieldId,
    documentId: config.documentId,
    organizationId: config.organizationId,
    paymentType: config.paymentType,
    items: config.items,
    currency: config.currency,
    dueDateTerms: config.dueDateTerms,
    customDueDays: config.customDueDays,
    customDueDate: config.customDueDate,
    totalAmountCents: config.totalAmountCents,
    feeHandling: config.feeHandling,
    taxEnabled: config.taxEnabled,
    taxBehavior: config.taxBehavior,
    recurringConfig: config.recurringConfig,
    installmentsConfig: config.installmentsConfig,
    depositBalanceConfig: config.depositBalanceConfig,
  };
}

export function isDocumentPaymentOrganizationAllowlisted(
  _organizationId: string,
  _env: Env = process.env
): boolean {
  return true;
}

function readRequiredValue(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === "") {
    throw new ConvexError(
      `Vortex Billing ${label} is required for document payments`
    );
  }
  return value;
}

function parseOptionalStringRecord(
  raw: string | undefined,
  name: string
): Record<string, string> {
  if (raw === undefined || raw.trim() === "") {
    return {};
  }
  return parseStringRecord(raw, name);
}

function parseStringRecord(raw: string, name: string): Record<string, string> {
  const parsed = parseJson(raw, name);
  const object = readObject(parsed, name);
  const record: Record<string, string> = {};

  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new ConvexError(`${name} must map strings to non-empty strings`);
    }
    record[key] = value;
  }

  return record;
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConvexError(`${label} is not valid JSON: ${message}`);
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string when present`);
  }
  return value;
}

function normalizeExternalIdPart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase();
}
