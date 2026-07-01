"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

type Env = {
  readonly [key: string]: string | undefined;
};

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type DocumentPaymentProvider = "stripe" | "vortex_billing";

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
};

type PaymentFieldConfigInput = {
  readonly _id: string;
  readonly fieldId: string;
  readonly documentId: string;
  readonly organizationId: string;
  readonly paymentType: "one_time" | "recurring" | "installments" | "deposit_balance";
  readonly items: readonly {
    readonly id: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
  readonly currency: string;
  readonly dueDateTerms: "on_receipt" | "net_15" | "net_30" | "net_60" | "custom";
  readonly customDueDays?: number;
  readonly customDueDate?: string;
  readonly totalAmountCents: number;
  readonly feeHandling: "absorb" | "pass_to_recipient";
  readonly taxEnabled: boolean;
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

type FeePolicy = {
  readonly policyId: string;
  readonly ownerMode: FeePolicyOwnerMode;
  readonly platformFee: {
    readonly mode: "none";
  };
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
  readonly metadata: Record<string, string>;
};

type CreatePayableResult = {
  readonly payableId: string;
  readonly paymentRequestId: string | undefined;
  readonly checkoutUrl: string | undefined;
};

type VortexCurrency = "USD" | "CAD";

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
  readonly taxMode: "not_taxable";
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
  readonly taxMode: "not_taxable";
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
  readonly taxMode: "not_taxable";
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

const DOCUMENT_PAYMENT_ALLOWLIST_ENV = "VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS";
const SHARED_PAYABLE_ALLOWLIST_ENV = "VORTEX_BILLING_PAYABLE_ORGANIZATION_IDS";
const API_BASE_URL_ENV = "VORTEX_BILLING_API_BASE_URL";
const API_KEY_ENV = "VORTEX_BILLING_API_KEY";
const SOURCE_NAMESPACE_ENV = "VORTEX_BILLING_SOURCE_NAMESPACE";
const DOCUMENT_CUSTOMER_MAP_ENV = "VORTEX_BILLING_DOCUMENT_CUSTOMER_MAP";
const SHARED_CUSTOMER_MAP_ENV = "VORTEX_BILLING_CUSTOMER_MAP";
const DOCUMENT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_DOCUMENT_ACCOUNT_MAP";
const SHARED_ACCOUNT_MAP_ENV = "VORTEX_BILLING_ACCOUNT_MAP";
const DOCUMENT_DEFAULT_ACCOUNT_ID_ENV = "VORTEX_BILLING_DOCUMENT_ACCOUNT_ID";
const SHARED_ACCOUNT_ID_ENV = "VORTEX_BILLING_ACCOUNT_ID";
const DOCUMENT_MERCHANT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_MAP";
const SHARED_MERCHANT_ACCOUNT_MAP_ENV = "VORTEX_BILLING_MERCHANT_ACCOUNT_MAP";
const DOCUMENT_DEFAULT_MERCHANT_ACCOUNT_ID_ENV = "VORTEX_BILLING_DOCUMENT_MERCHANT_ACCOUNT_ID";
const SHARED_MERCHANT_ACCOUNT_ID_ENV = "VORTEX_BILLING_MERCHANT_ACCOUNT_ID";
const DOCUMENT_PRICE_MAP_ENV = "VORTEX_BILLING_DOCUMENT_PRICE_MAP";
const SHARED_PRICE_MAP_ENV = "VORTEX_BILLING_PRICE_MAP";
const PAYMENTS_ENVIRONMENT_ENV = "VORTEX_BILLING_PAYMENTS_ENVIRONMENT";

export function selectDocumentPaymentProvider(
  organizationId: string,
  configs: readonly Pick<PaymentFieldConfigInput, "paymentType" | "taxEnabled">[],
  env: Env = process.env,
): DocumentPaymentProvider {
  const allowlist = env[DOCUMENT_PAYMENT_ALLOWLIST_ENV] ?? env[SHARED_PAYABLE_ALLOWLIST_ENV];
  if (!isOrganizationAllowlisted(organizationId, allowlist)) {
    return "stripe";
  }
  if (configs.length === 0) {
    return "stripe";
  }
  return configs.every(
    (config) =>
      (config.paymentType === "one_time" ||
        config.paymentType === "recurring" ||
        config.paymentType === "installments" ||
        config.paymentType === "deposit_balance") &&
      !config.taxEnabled,
  )
    ? "vortex_billing"
    : "stripe";
}

export function readVortexBillingEnv(input: VortexBillingEnvInput): VortexBillingEnv {
  const customerMap = parseOptionalStringRecord(input.customerMapJson, "customerMapJson");
  const billingAccountMap = parseOptionalStringRecord(
    input.billingAccountMapJson,
    "billingAccountMapJson",
  );
  const merchantAccountMap = parseOptionalStringRecord(
    input.merchantAccountMapJson,
    "merchantAccountMapJson",
  );
  const priceMap = parseOptionalStringRecord(input.priceMapJson, "priceMapJson");

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
  };
}

function readVortexBillingEnvFromProcess(env: Env = process.env): VortexBillingEnv {
  return readVortexBillingEnv({
    apiBaseUrl: env[API_BASE_URL_ENV],
    apiKey: env[API_KEY_ENV],
    sourceNamespace: env[SOURCE_NAMESPACE_ENV] ?? "seal",
    customerMapJson: env[DOCUMENT_CUSTOMER_MAP_ENV] ?? env[SHARED_CUSTOMER_MAP_ENV],
    billingAccountMapJson: env[DOCUMENT_ACCOUNT_MAP_ENV] ?? env[SHARED_ACCOUNT_MAP_ENV],
    defaultBillingAccountId: env[DOCUMENT_DEFAULT_ACCOUNT_ID_ENV] ?? env[SHARED_ACCOUNT_ID_ENV],
    merchantAccountMapJson:
      env[DOCUMENT_MERCHANT_ACCOUNT_MAP_ENV] ?? env[SHARED_MERCHANT_ACCOUNT_MAP_ENV],
    defaultMerchantAccountId:
      env[DOCUMENT_DEFAULT_MERCHANT_ACCOUNT_ID_ENV] ?? env[SHARED_MERCHANT_ACCOUNT_ID_ENV],
    paymentsEnvironment: env[PAYMENTS_ENVIRONMENT_ENV] ?? "sandbox",
    priceMapJson: env[DOCUMENT_PRICE_MAP_ENV] ?? env[SHARED_PRICE_MAP_ENV],
  });
}

export function buildCreatePayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreatePayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "one_time") {
    throw new ConvexError("Vortex Billing document bridge only supports one-time payments");
  }
  if (config.taxEnabled) {
    throw new ConvexError(
      "Vortex Billing document bridge does not support Seal tax-enabled fields yet",
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }

  const organizationKey = String(config.organizationId);
  const customerExternalId = env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(`Vortex Billing customer missing for recipient: ${recipient.email}`);
  }

  const billingAccountId = env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(`Vortex Billing account missing for organization: ${organizationKey}`);
  }

  const merchantAccountId =
    env.merchantAccountMap[organizationKey] ?? env.defaultMerchantAccountId ?? "";
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
    feePolicy: buildFeePolicy(config),
    ...(dueAt !== undefined ? { dueAt } : {}),
    lineItems: config.items.map((item) => buildPayableLineItem(item, env.priceMap)),
    metadata: {
      sourceSystem: env.sourceNamespace,
      vortexPaymentsEnvironment: env.paymentsEnvironment,
      sealOrganizationId: organizationKey,
      sealDocumentId: String(config.documentId),
      sealPaymentFieldId: String(config.fieldId),
      sealPaymentConfigId: sourceId,
      recipientEmail: recipient.email,
      ...(recipient.name !== undefined ? { recipientName: recipient.name } : {}),
      ...(merchantAccountId.length > 0 ? { vortexMerchantAccountId: merchantAccountId } : {}),
    },
  };
}

export function buildCreateRecurringPayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreateRecurringPayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "recurring") {
    throw new ConvexError("Vortex Billing recurring document bridge requires recurring payments");
  }
  if (config.taxEnabled) {
    throw new ConvexError(
      "Vortex Billing document bridge does not support Seal tax-enabled fields yet",
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (config.recurringConfig === undefined) {
    throw new ConvexError("Recurring payment field is missing recurring configuration");
  }
  if (config.recurringConfig.intervalCount <= 0) {
    throw new ConvexError("Recurring payment interval count must be greater than zero");
  }

  const organizationKey = String(config.organizationId);
  const customerExternalId = env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(`Vortex Billing customer missing for recipient: ${recipient.email}`);
  }

  const billingAccountId = env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(`Vortex Billing account missing for organization: ${organizationKey}`);
  }

  const merchantAccountId =
    env.merchantAccountMap[organizationKey] ?? env.defaultMerchantAccountId ?? "";
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
    lineItems: config.items.map((item) => buildPayableLineItem(item, env.priceMap)),
    taxMode: "not_taxable",
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config),
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
      ...(recipient.name !== undefined ? { recipientName: recipient.name } : {}),
      ...(merchantAccountId.length > 0 ? { vortexMerchantAccountId: merchantAccountId } : {}),
    },
  };
}

export function buildCreateInstallmentPayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreateInstallmentPayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "installments") {
    throw new ConvexError("Vortex Billing installment document bridge requires installments");
  }
  if (config.taxEnabled) {
    throw new ConvexError(
      "Vortex Billing document bridge does not support Seal tax-enabled fields yet",
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (config.installmentsConfig === undefined) {
    throw new ConvexError("Installment payment field is missing installment configuration");
  }
  const installmentsConfig = config.installmentsConfig;

  const organizationKey = String(config.organizationId);
  const customerExternalId = env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(`Vortex Billing customer missing for recipient: ${recipient.email}`);
  }

  const billingAccountId = env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(`Vortex Billing account missing for organization: ${organizationKey}`);
  }

  const merchantAccountId =
    env.merchantAccountMap[organizationKey] ?? env.defaultMerchantAccountId ?? "";
  const sourceId = String(config._id);
  const firstDueAt = getDueAt(config, now) ?? new Date(now).toISOString();
  const amounts = buildInstallmentAmounts(config.totalAmountCents, installmentsConfig);

  return {
    sourceType: "document_payment_field",
    sourceId,
    documentId: String(config.documentId),
    paymentFieldId: String(config.fieldId),
    customerExternalId,
    billingAccountId,
    ...(merchantAccountId.length > 0 ? { merchantAccountId } : {}),
    currency: toVortexCurrency(config.currency),
    taxMode: "not_taxable",
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config),
    installments: amounts.map((amountDue, index) => ({
      installmentNumber: index + 1,
      role: "installment",
      dueAt: addInstallmentInterval(firstDueAt, installmentsConfig.interval, index),
      amountDue,
      lineItems: buildInstallmentLineItems(config, amountDue, env.priceMap),
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
      ...(recipient.name !== undefined ? { recipientName: recipient.name } : {}),
      ...(merchantAccountId.length > 0 ? { vortexMerchantAccountId: merchantAccountId } : {}),
    },
  };
}

export function buildCreateDepositBalancePayableRequest(input: {
  readonly config: PaymentFieldConfigInput;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreateDepositBalancePayableRequest {
  const { config, recipient, env, now } = input;
  if (config.paymentType !== "deposit_balance") {
    throw new ConvexError(
      "Vortex Billing deposit/balance document bridge requires deposit_balance payments",
    );
  }
  if (config.taxEnabled) {
    throw new ConvexError(
      "Vortex Billing document bridge does not support Seal tax-enabled fields yet",
    );
  }
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (config.depositBalanceConfig === undefined) {
    throw new ConvexError("Deposit/balance payment field is missing deposit balance configuration");
  }

  const organizationKey = String(config.organizationId);
  const customerExternalId = env.customerMap[recipient.email] ?? env.customerMap[organizationKey];
  if (!customerExternalId) {
    throw new ConvexError(`Vortex Billing customer missing for recipient: ${recipient.email}`);
  }

  const billingAccountId = env.billingAccountMap[organizationKey] ?? env.defaultBillingAccountId;
  if (!billingAccountId) {
    throw new ConvexError(`Vortex Billing account missing for organization: ${organizationKey}`);
  }

  const merchantAccountId =
    env.merchantAccountMap[organizationKey] ?? env.defaultMerchantAccountId ?? "";
  const sourceId = String(config._id);
  const depositDueAt = getDueAt(config, now) ?? new Date(now).toISOString();
  const amounts = buildDepositBalanceAmounts(config.totalAmountCents, config.depositBalanceConfig);
  const balanceDueAt = addDepositBalanceDays(
    depositDueAt,
    config.depositBalanceConfig.balanceDueDays,
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
    taxMode: "not_taxable",
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(config),
    deposit: {
      dueAt: depositDueAt,
      amountDue: amounts.depositAmountDue,
      lineItems: buildDepositBalanceLineItems(
        config,
        "deposit",
        amounts.depositAmountDue,
        env.priceMap,
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
      ...(recipient.name !== undefined ? { recipientName: recipient.name } : {}),
      ...(merchantAccountId.length > 0 ? { vortexMerchantAccountId: merchantAccountId } : {}),
    },
  };
}

function buildPayableLineItem(
  item: PaymentFieldConfigInput["items"][number],
  priceMap: Record<string, string>,
): JsonObject {
  const priceId = priceMap[item.id];
  if (!priceId) {
    throw new ConvexError(`Vortex Billing price missing for payment item: ${item.id}`);
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
): readonly JsonObject[] {
  if (config.items.length !== 1) {
    throw new ConvexError("Vortex Billing installment bridge requires exactly one line item");
  }
  const item = config.items[0];
  if (item === undefined) {
    throw new ConvexError("Payment field has no line items configured");
  }
  if (!Number.isInteger(item.unitPrice) || item.unitPrice <= 0) {
    throw new ConvexError("Installment line item unit price must be a positive integer");
  }
  if (amountDue % item.unitPrice !== 0) {
    throw new ConvexError("Installment amount must divide evenly into the configured line item");
  }

  return [buildPayableLineItem({ ...item, quantity: amountDue / item.unitPrice }, priceMap)];
}

function buildDepositBalanceLineItems(
  config: Pick<PaymentFieldConfigInput, "items">,
  role: "deposit" | "balance",
  amountDue: number,
  priceMap: Record<string, string>,
): readonly JsonObject[] {
  if (config.items.length !== 1) {
    throw new ConvexError("Vortex Billing deposit/balance bridge requires exactly one line item");
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
    ),
  ];
}

function buildDepositBalanceAmounts(
  totalAmountCents: number,
  config: NonNullable<PaymentFieldConfigInput["depositBalanceConfig"]>,
): { readonly depositAmountDue: number; readonly balanceAmountDue: number } {
  if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
    throw new ConvexError("Deposit/balance total amount must be a positive integer");
  }
  if (config.depositPercent <= 0 || config.depositPercent >= 100) {
    throw new ConvexError("Deposit percent must be greater than 0 and less than 100");
  }
  if (!Number.isInteger(config.balanceDueDays) || config.balanceDueDays < 1) {
    throw new ConvexError("Deposit/balance due days must be at least one");
  }

  const depositAmountDue = Math.round(totalAmountCents * (config.depositPercent / 100));
  const balanceAmountDue = totalAmountCents - depositAmountDue;
  if (depositAmountDue <= 0 || balanceAmountDue <= 0) {
    throw new ConvexError("Deposit and balance amounts must both be greater than zero");
  }

  return { depositAmountDue, balanceAmountDue };
}

function addDepositBalanceDays(firstDueAt: string, balanceDueDays: number): string {
  const firstDueTime = new Date(firstDueAt).getTime();
  if (Number.isNaN(firstDueTime)) {
    throw new ConvexError("Deposit due date is invalid");
  }
  return new Date(firstDueTime + balanceDueDays * 24 * 60 * 60 * 1000).toISOString();
}

function buildInstallmentAmounts(
  totalAmountCents: number,
  config: NonNullable<PaymentFieldConfigInput["installmentsConfig"]>,
): readonly number[] {
  if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
    throw new ConvexError("Installment total amount must be a positive integer");
  }
  if (!Number.isInteger(config.count) || config.count < 2) {
    throw new ConvexError("Installment count must be at least two");
  }
  if (config.firstPaymentAmount !== undefined) {
    if (!Number.isInteger(config.firstPaymentAmount) || config.firstPaymentAmount <= 0) {
      throw new ConvexError("Installment first payment amount must be a positive integer");
    }
    if (config.firstPaymentAmount >= totalAmountCents) {
      throw new ConvexError("Installment first payment amount must be less than the total");
    }
    return [
      config.firstPaymentAmount,
      ...splitInstallmentAmount(totalAmountCents - config.firstPaymentAmount, config.count - 1),
    ];
  }

  return splitInstallmentAmount(totalAmountCents, config.count);
}

function splitInstallmentAmount(totalAmountCents: number, count: number): readonly number[] {
  const baseAmount = Math.floor(totalAmountCents / count);
  const remainder = totalAmountCents % count;
  if (baseAmount <= 0) {
    throw new ConvexError("Installment amount must be greater than zero");
  }

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? baseAmount + 1 : baseAmount,
  );
}

function addInstallmentInterval(
  firstDueAt: string,
  interval: NonNullable<PaymentFieldConfigInput["installmentsConfig"]>["interval"],
  offset: number,
): string {
  const firstDueTime = new Date(firstDueAt).getTime();
  if (Number.isNaN(firstDueTime)) {
    throw new ConvexError("Installment first due date is invalid");
  }
  const days = interval === "week" ? 7 * offset : 30 * offset;
  return new Date(firstDueTime + days * 24 * 60 * 60 * 1000).toISOString();
}

function buildRecurringEndPolicy(
  config: NonNullable<PaymentFieldConfigInput["recurringConfig"]>,
): RecurringEndPolicy {
  switch (config.endCondition) {
    case "never":
      return { mode: "never" };
    case "after_count":
      if (config.endAfterCount === undefined || config.endAfterCount <= 0) {
        throw new ConvexError("Recurring payment end-after count must be greater than zero");
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
  throw new ConvexError("Vortex Billing document bridge only supports USD and CAD");
}

function buildFeePolicy(config: Pick<PaymentFieldConfigInput, "_id" | "feeHandling">): FeePolicy {
  const ownerMode: FeePolicyOwnerMode =
    config.feeHandling === "pass_to_recipient"
      ? "customer_pays_processing"
      : "merchant_pays_processing";
  const sourceId = String(config._id);

  return {
    policyId: `seal_document_payment_${normalizeExternalIdPart(sourceId)}`,
    ownerMode,
    platformFee: { mode: "none" },
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
        "fee policy is modeled for Vortex payable creation; settlement execution remains provider-owned",
    },
    evidence: [
      `source:document_payment_field:${sourceId}`,
      `fee_owner:${ownerMode}`,
      "platform_fee:none",
      `seal_fee_handling:${config.feeHandling}`,
    ],
  };
}

function getDueAt(
  config: Pick<PaymentFieldConfigInput, "dueDateTerms" | "customDueDays" | "customDueDate">,
  now: number,
): string | undefined {
  if (config.customDueDate !== undefined && config.customDueDate.trim().length > 0) {
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
  customDueDays?: number,
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
  recipientMap: Map<string, Doc<"document_recipients">>,
): PaymentRecipient {
  if (config.items.length === 0) {
    throw new ConvexError("Payment field has no line items configured");
  }

  const field = fieldMap.get(config.fieldId.toString());
  if (!field) {
    throw new ConvexError("Payment field not found");
  }
  if (!field.recipientId) {
    throw new ConvexError("Payment field must be assigned to a recipient before processing");
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
  idempotencyKey: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<CreatePayableResult> {
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: "/v1/payables",
      idempotencyKey,
      body: request as unknown as JsonObject,
    },
    fetcher,
  );
  return readCreatePayableResult(responseBody);
}

async function createVortexRecurringPayable(
  request: CreateRecurringPayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<CreateRecurringPayableResult> {
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: "/v1/recurring-payables",
      idempotencyKey,
      body: request as unknown as JsonObject,
    },
    fetcher,
  );
  return readCreateRecurringPayableResult(responseBody);
}

async function createVortexInstallmentPayable(
  request: CreateInstallmentPayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<CreateInstallmentPayableResult> {
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: "/v1/installment-payables",
      idempotencyKey,
      body: request as unknown as JsonObject,
    },
    fetcher,
  );
  return readCreateInstallmentPayableResult(responseBody);
}

async function createVortexDepositBalancePayable(
  request: CreateDepositBalancePayableRequest,
  env: VortexBillingEnv,
  idempotencyKey: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<CreateDepositBalancePayableResult> {
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: "/v1/deposit-balance-payables",
      idempotencyKey,
      body: request as unknown as JsonObject,
    },
    fetcher,
  );
  return readCreateDepositBalancePayableResult(responseBody);
}

async function requestVortexBillingJson(
  input: {
    readonly apiBaseUrl: string;
    readonly apiKey: string;
    readonly path: string;
    readonly idempotencyKey: string;
    readonly body: JsonObject;
  },
  fetcher: Fetcher,
): Promise<unknown> {
  const response = await fetcher(`${trimTrailingSlash(input.apiBaseUrl)}${input.path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey,
      "x-vortex-service": "billing",
    },
    body: JSON.stringify(input.body),
  });

  const text = await response.text();
  const responseBody = text.length > 0 ? parseJson(text, "Vortex Billing response") : null;

  if (!response.ok) {
    throw new ConvexError(
      `Vortex Billing payable failed (${response.status}): ${summarizeJson(responseBody)}`,
    );
  }

  return responseBody;
}

function readCreatePayableResult(body: unknown): CreatePayableResult {
  const root = readObject(body, "Vortex Billing payable response");
  const data = readObject(root.data, "Vortex Billing payable response data");
  const payable = readObject(data.payable, "Vortex Billing payable response payable");
  const lineage = readObject(payable.lineage, "Vortex Billing payable response lineage");
  const payableId = readString(payable.payableId, "Vortex Billing payable id");
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing payment request id",
  );
  const checkoutUrl = readOptionalString(lineage.checkoutUrl, "Vortex Billing checkout URL");

  return {
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

function readCreateRecurringPayableResult(body: unknown): CreateRecurringPayableResult {
  const root = readObject(body, "Vortex Billing recurring payable response");
  const data = readObject(root.data, "Vortex Billing recurring payable response data");
  const recurringPayable = readObject(
    data.recurringPayable,
    "Vortex Billing recurring payable response recurring payable",
  );
  const payable = readObject(data.payable, "Vortex Billing recurring payable response payable");
  const lineage = readObject(payable.lineage, "Vortex Billing recurring payable response lineage");
  const recurringPayableId = readString(
    recurringPayable.recurringPayableId,
    "Vortex Billing recurring payable id",
  );
  const payableId = readString(payable.payableId, "Vortex Billing recurring cycle payable id");
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing recurring cycle payment request id",
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing recurring cycle checkout URL",
  );

  return {
    recurringPayableId,
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

function readCreateInstallmentPayableResult(body: unknown): CreateInstallmentPayableResult {
  const root = readObject(body, "Vortex Billing installment payable response");
  const data = readObject(root.data, "Vortex Billing installment payable response data");
  const installmentPayable = readObject(
    data.installmentPayable,
    "Vortex Billing installment payable response installment payable",
  );
  const payable = readObject(data.payable, "Vortex Billing installment payable response payable");
  const lineage = readObject(
    payable.lineage,
    "Vortex Billing installment payable response lineage",
  );
  const installmentPayableId = readString(
    installmentPayable.installmentPayableId,
    "Vortex Billing installment payable id",
  );
  const payableId = readString(payable.payableId, "Vortex Billing first installment payable id");
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing first installment payment request id",
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing first installment checkout URL",
  );

  return {
    installmentPayableId,
    payableId,
    paymentRequestId,
    checkoutUrl,
  };
}

function readCreateDepositBalancePayableResult(body: unknown): CreateDepositBalancePayableResult {
  const root = readObject(body, "Vortex Billing deposit/balance payable response");
  const data = readObject(root.data, "Vortex Billing deposit/balance payable response data");
  const depositBalancePayable = readObject(
    data.depositBalancePayable,
    "Vortex Billing deposit/balance payable response deposit balance payable",
  );
  const payable = readObject(data.payable, "Vortex Billing deposit/balance payable response payable");
  const lineage = readObject(
    payable.lineage,
    "Vortex Billing deposit/balance payable response lineage",
  );
  // Vortex models a deposit/balance payable on top of the installment payable object, so its id
  // field is literally `installmentPayableId` (not a copy-paste bug). The Vortex proof asserts
  // installmentPayableId === the deposit-balance payable id.
  const depositBalancePayableId = readString(
    depositBalancePayable.installmentPayableId,
    "Vortex Billing deposit/balance payable id",
  );
  const payableId = readString(payable.payableId, "Vortex Billing deposit payable id");
  const paymentRequestId = readOptionalString(
    lineage.paymentRequestId,
    "Vortex Billing deposit payment request id",
  );
  const checkoutUrl = readOptionalString(
    lineage.checkoutUrl,
    "Vortex Billing deposit checkout URL",
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
        providerInvoiceId: v.string(),
        totalAmountCents: v.number(),
        currency: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const configs: Doc<"payment_field_configs">[] = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId },
    );

    if (configs.length === 0) {
      return { paymentLinks: [] };
    }
    if (selectDocumentPaymentProvider(args.organizationId, configs) !== "vortex_billing") {
      throw new ConvexError("Vortex Billing document payment bridge is not enabled");
    }

    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );
    const recipientMap = new Map(
      recipients.map((recipient) => [recipient._id.toString(), recipient]),
    );

    const fields: Doc<"signature_fields">[] = await ctx.runQuery(
      internal.signature_fields.queries.getFieldsByDocumentInternal,
      { documentId: args.documentId },
    );
    const fieldMap = new Map(fields.map((field) => [field._id.toString(), field]));

    const env = readVortexBillingEnvFromProcess();
    const paymentLinks: Array<{
      recipientEmail: string;
      hostedInvoiceUrl: string | null;
      providerInvoiceId: string;
      totalAmountCents: number;
      currency: string;
    }> = [];

    for (const config of configs) {
      const recipient = resolvePaymentFieldRecipient(config, fieldMap, recipientMap);
      const configInput = toPaymentFieldConfigInput(config);
      if (configInput.paymentType === "recurring") {
        const recurringRequest = buildCreateRecurringPayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
        });
        const recurringPayable = await createVortexRecurringPayable(
          recurringRequest,
          env,
          `seal-document-recurring-payable:${config._id}`,
        );
        if (recurringPayable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing recurring payable response did not include checkout URL",
          );
        }

        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId: config._id,
          paymentStatus: "awaiting",
          vortexPayableId: recurringPayable.payableId,
          vortexRecurringPayableId: recurringPayable.recurringPayableId,
          vortexPaymentRequestId: recurringPayable.paymentRequestId,
          hostedInvoiceUrl: recurringPayable.checkoutUrl,
          customerEmail: recipient.email,
          customerName: recipient.name,
        });

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: recurringPayable.checkoutUrl,
          providerInvoiceId: recurringPayable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      } else if (configInput.paymentType === "installments") {
        const installmentRequest = buildCreateInstallmentPayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
        });
        const installmentPayable = await createVortexInstallmentPayable(
          installmentRequest,
          env,
          `seal-document-installment-payable:${config._id}`,
        );
        if (installmentPayable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing installment payable response did not include checkout URL",
          );
        }

        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId: config._id,
          paymentStatus: "awaiting",
          vortexPayableId: installmentPayable.payableId,
          vortexInstallmentPayableId: installmentPayable.installmentPayableId,
          vortexPaymentRequestId: installmentPayable.paymentRequestId,
          hostedInvoiceUrl: installmentPayable.checkoutUrl,
          customerEmail: recipient.email,
          customerName: recipient.name,
        });

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: installmentPayable.checkoutUrl,
          providerInvoiceId: installmentPayable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      } else if (configInput.paymentType === "deposit_balance") {
        const depositBalanceRequest = buildCreateDepositBalancePayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
        });
        const depositBalancePayable = await createVortexDepositBalancePayable(
          depositBalanceRequest,
          env,
          `seal-document-deposit-balance-payable:${config._id}`,
        );
        if (depositBalancePayable.checkoutUrl === undefined) {
          throw new ConvexError(
            "Vortex Billing deposit/balance payable response did not include checkout URL",
          );
        }

        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId: config._id,
          paymentStatus: "awaiting",
          vortexPayableId: depositBalancePayable.payableId,
          vortexDepositBalancePayableId: depositBalancePayable.depositBalancePayableId,
          vortexPaymentRequestId: depositBalancePayable.paymentRequestId,
          hostedInvoiceUrl: depositBalancePayable.checkoutUrl,
          customerEmail: recipient.email,
          customerName: recipient.name,
        });

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: depositBalancePayable.checkoutUrl,
          providerInvoiceId: depositBalancePayable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      } else {
        const payableRequest = buildCreatePayableRequest({
          config: configInput,
          recipient,
          env,
          now: Date.now(),
        });
        const payable = await createVortexPayable(
          payableRequest,
          env,
          `seal-document-payable:${config._id}`,
        );
        if (payable.checkoutUrl === undefined) {
          throw new ConvexError("Vortex Billing payable response did not include checkout URL");
        }

        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId: config._id,
          paymentStatus: "awaiting",
          vortexPayableId: payable.payableId,
          vortexPaymentRequestId: payable.paymentRequestId,
          hostedInvoiceUrl: payable.checkoutUrl,
          customerEmail: recipient.email,
          customerName: recipient.name,
        });

        paymentLinks.push({
          recipientEmail: recipient.email,
          hostedInvoiceUrl: payable.checkoutUrl,
          providerInvoiceId: payable.payableId,
          totalAmountCents: config.totalAmountCents,
          currency: config.currency,
        });
      }
    }

    return { paymentLinks };
  },
});

function toPaymentFieldConfigInput(config: Doc<"payment_field_configs">): PaymentFieldConfigInput {
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
    recurringConfig: config.recurringConfig,
    installmentsConfig: config.installmentsConfig,
    depositBalanceConfig: config.depositBalanceConfig,
  };
}

function isOrganizationAllowlisted(
  organizationId: string,
  configured: string | undefined,
): boolean {
  if (configured === undefined || configured.trim() === "" || configured.trim() === "[]") {
    return false;
  }

  const normalized = configured.trim();
  if (normalized === "*") {
    return true;
  }

  if (normalized.startsWith("[")) {
    const parsed = parseJson(normalized, DOCUMENT_PAYMENT_ALLOWLIST_ENV);
    if (!Array.isArray(parsed)) {
      throw new ConvexError(
        `${DOCUMENT_PAYMENT_ALLOWLIST_ENV} must be a JSON string array, "*", or "[]"`,
      );
    }

    return parsed.some((entry) => entry === organizationId);
  }

  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .includes(organizationId);
}

function readRequiredValue(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === "") {
    throw new ConvexError(`Vortex Billing ${label} is required for document payments`);
  }
  return value;
}

function parseOptionalStringRecord(raw: string | undefined, name: string): Record<string, string> {
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

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeExternalIdPart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase();
}

function summarizeJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "unreadable response";
  }
}
