import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

type PaymentFieldConfig = Pick<
  Doc<"payment_field_configs">,
  | "_id"
  | "fieldId"
  | "documentId"
  | "organizationId"
  | "paymentType"
  | "items"
  | "currency"
  | "dueDateTerms"
  | "customDueDays"
  | "customDueDate"
  | "totalAmountCents"
  | "feeHandling"
  | "taxEnabled"
  | "recurringConfig"
  | "installmentsConfig"
  | "depositBalanceConfig"
>;

type PaymentRecipient = {
  readonly email: string;
  readonly name: string | undefined;
};

type VortexLineItem = {
  readonly priceId: string;
  readonly quantity?: number;
  readonly taxable: boolean;
  readonly metadata: Record<string, string>;
};

type VortexFeePolicy = {
  readonly policyId: string;
  readonly ownerMode:
    | "merchant_pays_processing"
    | "customer_pays_processing"
    | "platform_absorbs_processing"
    | "platform_fee_deducted";
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
  readonly evidence: string[];
};

type CreatePayableRequest = {
  readonly sourceType: "document_payment_field";
  readonly sourceId: string;
  readonly documentId: string;
  readonly paymentFieldId: string;
  readonly customerExternalId: string;
  readonly billingAccountId: string;
  readonly collectionIntent: "manual";
  readonly feePolicy: VortexFeePolicy;
  readonly dueAt?: string;
  readonly lineItems: readonly VortexLineItem[];
  readonly metadata: Record<string, string>;
};

type CreateRecurringPayableRequest = CreatePayableRequest & {
  readonly recurringPayableId?: string;
  readonly merchantAccountId: string;
  readonly currency: "USD" | "CAD";
  readonly taxMode: "not_taxable" | "taxable_requires_evidence";
  readonly cadence: {
    readonly interval: "week" | "month" | "year";
    readonly intervalCount: number;
  };
  readonly endPolicy:
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
  readonly startAt: string;
};

type InstallmentPlanItem = {
  readonly installmentNumber: number;
  readonly role: "installment";
  readonly dueAt: string;
  readonly amountDue: number;
  readonly lineItems: readonly VortexLineItem[];
};

type CreateInstallmentPayableRequest = Omit<CreatePayableRequest, "dueAt" | "lineItems"> & {
  readonly installmentPayableId?: string;
  readonly merchantAccountId: string;
  readonly currency: "USD" | "CAD";
  readonly taxMode: "not_taxable" | "taxable_requires_evidence";
  readonly installments: readonly InstallmentPlanItem[];
};

type DepositBalancePartRequest = {
  readonly dueAt: string;
  readonly amountDue: number;
  readonly lineItems: readonly VortexLineItem[];
};

type CreateDepositBalancePayableRequest = Omit<CreatePayableRequest, "dueAt" | "lineItems"> & {
  readonly depositBalancePayableId?: string;
  readonly merchantAccountId: string;
  readonly currency: "USD" | "CAD";
  readonly taxMode: "not_taxable" | "taxable_requires_evidence";
  readonly deposit: DepositBalancePartRequest;
  readonly balance: DepositBalancePartRequest;
};

type VortexMerchantReadiness = {
  readonly merchantAccountId: string;
  readonly merchantStatus: string;
  readonly canAcceptPayments: boolean;
  readonly payoutReadiness: string;
  readonly openRequirementIds: readonly string[];
  readonly activeCapabilityKeys: readonly string[];
  readonly restrictedCapabilityKeys: readonly string[];
};

type VortexPayableLink = {
  readonly recipientEmail: string;
  readonly hostedInvoiceUrl: string | null;
  readonly paymentObjectId: string;
  readonly totalAmountCents: number;
  readonly currency: string;
};

type VortexCreatePayableResult = {
  readonly recurringPayableId: string | undefined;
  readonly installmentPayableId: string | undefined;
  readonly depositBalancePayableId: string | undefined;
  readonly payableId: string;
  readonly checkoutUrl: string | null;
  readonly paymentRequestId: string | undefined;
};

type VortexBillingEnv = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly sourceNamespace: string | undefined;
  readonly customerMap: ReadonlyMap<string, string>;
  readonly billingAccountMap: ReadonlyMap<string, string>;
  readonly defaultBillingAccountId: string | undefined;
  readonly merchantAccountMap: ReadonlyMap<string, string>;
  readonly defaultMerchantAccountId: string | undefined;
  readonly paymentsEnvironment: "sandbox" | "production";
  readonly priceMap: ReadonlyMap<string, string>;
};

type VortexBillingEnvInput = {
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

function readRequiredEnv(name: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new ConvexError(`${name} is required for Vortex Billing payable bridge`);
  }
  return value.trim();
}

function parseStringMap(name: string, raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim().length === 0) {
    return new Map();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ConvexError(`${name} must be valid JSON`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConvexError(`${name} must be a JSON object`);
  }
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ConvexError(`${name}.${key} must be a non-empty string`);
    }
    entries.push([key, value.trim()]);
  }
  return new Map(entries);
}

export function readVortexBillingEnv(input: VortexBillingEnvInput): VortexBillingEnv {
  const paymentsEnvironment = input.paymentsEnvironment?.trim() ?? "sandbox";
  if (paymentsEnvironment !== "sandbox" && paymentsEnvironment !== "production") {
    throw new ConvexError("VORTEX_BILLING_PAYMENTS_ENVIRONMENT must be sandbox or production");
  }

  return {
    apiBaseUrl: readRequiredEnv("VORTEX_BILLING_API_BASE_URL", input.apiBaseUrl).replace(
      /\/+$/,
      "",
    ),
    apiKey: readRequiredEnv("VORTEX_BILLING_API_KEY", input.apiKey),
    sourceNamespace:
      input.sourceNamespace !== undefined && input.sourceNamespace.trim().length > 0
        ? input.sourceNamespace.trim()
        : undefined,
    customerMap: parseStringMap("VORTEX_BILLING_CUSTOMER_MAP", input.customerMapJson),
    billingAccountMap: parseStringMap("VORTEX_BILLING_ACCOUNT_MAP", input.billingAccountMapJson),
    defaultBillingAccountId:
      input.defaultBillingAccountId !== undefined && input.defaultBillingAccountId.trim().length > 0
        ? input.defaultBillingAccountId.trim()
        : undefined,
    merchantAccountMap: parseStringMap(
      "VORTEX_BILLING_MERCHANT_ACCOUNT_MAP",
      input.merchantAccountMapJson,
    ),
    defaultMerchantAccountId:
      input.defaultMerchantAccountId !== undefined &&
      input.defaultMerchantAccountId.trim().length > 0
        ? input.defaultMerchantAccountId.trim()
        : undefined,
    paymentsEnvironment,
    priceMap: parseStringMap("VORTEX_BILLING_PRICE_MAP", input.priceMapJson),
  };
}

function resolveCustomerExternalId(env: VortexBillingEnv, recipient: PaymentRecipient): string {
  const mapped = env.customerMap.get(recipient.email);
  if (mapped === undefined) {
    throw new ConvexError(
      `Missing Vortex customer mapping for recipient ${recipient.email}. Set VORTEX_BILLING_CUSTOMER_MAP.`,
    );
  }
  return mapped;
}

function resolveBillingAccountId(
  env: VortexBillingEnv,
  organizationId: Id<"organizations">,
): string {
  return env.billingAccountMap.get(organizationId) ?? env.defaultBillingAccountId ?? "";
}

function resolveMerchantAccountId(
  env: VortexBillingEnv,
  organizationId: Id<"organizations">,
): string {
  return env.merchantAccountMap.get(organizationId) ?? env.defaultMerchantAccountId ?? "";
}

function sourceIdForConfig(config: PaymentFieldConfig, env: VortexBillingEnv): string {
  const configId = config._id.toString();
  return env.sourceNamespace === undefined ? configId : `${env.sourceNamespace}:${configId}`;
}

function assertOneTimePayment(config: PaymentFieldConfig): void {
  if (config.paymentType !== "one_time") {
    throw new ConvexError(
      `Vortex Billing payable bridge only supports one_time payment fields. Unsupported payment type: ${config.paymentType}`,
    );
  }
}

function assertRecurringPayment(config: PaymentFieldConfig): void {
  if (config.paymentType !== "recurring") {
    throw new ConvexError(
      `Vortex Billing recurring payable bridge only supports recurring payment fields. Unsupported payment type: ${config.paymentType}`,
    );
  }
  if (config.recurringConfig === undefined) {
    throw new ConvexError("Recurring payment field is missing recurringConfig");
  }
}

function assertInstallmentPayment(config: PaymentFieldConfig): void {
  if (config.paymentType !== "installments") {
    throw new ConvexError(
      `Vortex Billing installment payable bridge only supports installments payment fields. Unsupported payment type: ${config.paymentType}`,
    );
  }
  if (config.installmentsConfig === undefined) {
    throw new ConvexError("Installment payment field is missing installmentsConfig");
  }
}

function assertDepositBalancePayment(config: PaymentFieldConfig): void {
  if (config.paymentType !== "deposit_balance") {
    throw new ConvexError(
      `Vortex Billing deposit/balance payable bridge only supports deposit_balance payment fields. Unsupported payment type: ${config.paymentType}`,
    );
  }
  if (config.depositBalanceConfig === undefined) {
    throw new ConvexError("Deposit/balance payment field is missing depositBalanceConfig");
  }
}

function resolveCurrency(config: PaymentFieldConfig): "USD" | "CAD" {
  const currency = config.currency.toUpperCase();
  if (currency === "USD" || currency === "CAD") {
    return currency;
  }
  throw new ConvexError(
    `Vortex Billing payable bridge does not support currency ${config.currency}`,
  );
}

function buildRecurringEndPolicy(
  config: PaymentFieldConfig,
): CreateRecurringPayableRequest["endPolicy"] {
  const recurringConfig = config.recurringConfig;
  if (recurringConfig === undefined) {
    throw new ConvexError("Recurring payment field is missing recurringConfig");
  }
  switch (recurringConfig.endCondition) {
    case "never":
      return { mode: "never" };
    case "after_count":
      if (recurringConfig.endAfterCount === undefined || recurringConfig.endAfterCount <= 0) {
        throw new ConvexError(
          "Recurring payment field after_count end condition requires endAfterCount",
        );
      }
      return { mode: "after_count", cycleCount: recurringConfig.endAfterCount };
    case "on_date":
      if (recurringConfig.endOnDate === undefined) {
        throw new ConvexError("Recurring payment field on_date end condition requires endOnDate");
      }
      return { mode: "on_date", endAt: new Date(recurringConfig.endOnDate).toISOString() };
  }
}

function resolveDueAt(config: PaymentFieldConfig, now: number): string | undefined {
  if (config.customDueDate !== undefined && config.customDueDate.trim().length > 0) {
    return new Date(config.customDueDate).toISOString();
  }

  const daysUntilDue = (() => {
    switch (config.dueDateTerms) {
      case "on_receipt":
        return undefined;
      case "net_15":
        return 15;
      case "net_30":
        return 30;
      case "net_60":
        return 60;
      case "custom":
        return config.customDueDays;
    }
  })();

  if (daysUntilDue === undefined) {
    return undefined;
  }
  return new Date(now + daysUntilDue * 86_400_000).toISOString();
}

function buildFeePolicy(config: PaymentFieldConfig): VortexFeePolicy {
  const scopeId = config.fieldId.toString();
  const ownerMode =
    config.feeHandling === "pass_to_recipient"
      ? "customer_pays_processing"
      : "merchant_pays_processing";

  return {
    policyId: `seal_payment_field_${scopeId}`,
    ownerMode,
    platformFee: { mode: "none" },
    source: {
      scope: "document_payment_field",
      scopeId,
    },
    audit: {
      createdByType: "adopter",
      createdByRef: "seal-vortex-billing-bridge",
      reason: "Seal document payment field routed through Vortex Billing payable bridge",
    },
    execution: {
      status: "modeled_not_settlement_executed",
      stopCondition:
        "Seal bridge models fee ownership in Vortex Billing; processor settlement execution is not claimed by this pass",
    },
    evidence: [
      `seal_document:${config.documentId}`,
      `seal_payment_field:${config.fieldId}`,
      `fee_handling:${config.feeHandling}`,
    ],
  };
}

function buildLineItems(
  config: PaymentFieldConfig,
  env: VortexBillingEnv,
): readonly VortexLineItem[] {
  return config.items.map((item) => {
    const priceId = env.priceMap.get(item.id);
    if (priceId === undefined) {
      throw new ConvexError(
        `Missing Vortex price mapping for Seal payment item ${item.id}. Set VORTEX_BILLING_PRICE_MAP.`,
      );
    }
    return {
      priceId,
      quantity: item.quantity,
      taxable: config.taxEnabled,
      metadata: {
        sealLineItemId: item.id,
        sealLineItemDescription: item.description,
        sealLineItemUnitPriceCents: item.unitPrice.toString(),
      },
    };
  });
}

function buildLineItemsWithPriceMapSuffix(
  config: PaymentFieldConfig,
  env: VortexBillingEnv,
  suffix: "deposit" | "balance",
  amountDue: number,
): readonly VortexLineItem[] {
  return config.items.map((item) => {
    const priceId = env.priceMap.get(`${item.id}:${suffix}`) ?? env.priceMap.get(item.id);
    if (priceId === undefined) {
      throw new ConvexError(
        `Missing Vortex price mapping for Seal payment item ${item.id}:${suffix}. Set VORTEX_BILLING_PRICE_MAP.`,
      );
    }
    return {
      priceId,
      quantity: item.quantity,
      taxable: config.taxEnabled,
      metadata: {
        sealLineItemId: item.id,
        sealLineItemDescription: item.description,
        sealLineItemUnitPriceCents: item.unitPrice.toString(),
        sealDepositBalancePart: suffix,
        sealDepositBalancePartAmountDueCents: amountDue.toString(),
      },
    };
  });
}

export function buildCreatePayableRequest(input: {
  readonly config: PaymentFieldConfig;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreatePayableRequest {
  assertOneTimePayment(input.config);
  const merchantAccountId = resolveMerchantAccountId(input.env, input.config.organizationId);
  if (merchantAccountId.length === 0) {
    throw new ConvexError(
      `Missing Vortex merchant account mapping for organization ${input.config.organizationId}. Set VORTEX_BILLING_MERCHANT_ACCOUNT_MAP or VORTEX_BILLING_MERCHANT_ACCOUNT_ID.`,
    );
  }
  const billingAccountId = resolveBillingAccountId(input.env, input.config.organizationId);
  if (billingAccountId.length === 0) {
    throw new ConvexError(
      `Missing Vortex billing account mapping for organization ${input.config.organizationId}. Set VORTEX_BILLING_ACCOUNT_MAP or VORTEX_BILLING_ACCOUNT_ID.`,
    );
  }

  return {
    sourceType: "document_payment_field",
    sourceId: sourceIdForConfig(input.config, input.env),
    documentId: input.config.documentId.toString(),
    paymentFieldId: input.config.fieldId.toString(),
    customerExternalId: resolveCustomerExternalId(input.env, input.recipient),
    billingAccountId,
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(input.config),
    dueAt: resolveDueAt(input.config, input.now),
    lineItems: buildLineItems(input.config, input.env),
    metadata: {
      sourceSystem: "seal",
      vortexMerchantAccountId: merchantAccountId,
      sealDocumentId: input.config.documentId.toString(),
      sealPaymentFieldConfigId: input.config._id.toString(),
      sealPaymentFieldId: input.config.fieldId.toString(),
      sealRecipientEmail: input.recipient.email,
      sealRecipientName: input.recipient.name ?? "",
      sealPaymentType: input.config.paymentType,
      sealTotalAmountCents: input.config.totalAmountCents.toString(),
      sealCurrency: input.config.currency,
    },
  };
}

export function buildCreateRecurringPayableRequest(input: {
  readonly config: PaymentFieldConfig;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreateRecurringPayableRequest {
  assertRecurringPayment(input.config);
  const merchantAccountId = resolveMerchantAccountId(input.env, input.config.organizationId);
  if (merchantAccountId.length === 0) {
    throw new ConvexError(
      `Missing Vortex merchant account mapping for organization ${input.config.organizationId}. Set VORTEX_BILLING_MERCHANT_ACCOUNT_MAP or VORTEX_BILLING_MERCHANT_ACCOUNT_ID.`,
    );
  }
  const oneTimeRequest = buildCreatePayableRequest({
    ...input,
    config: {
      ...input.config,
      paymentType: "one_time",
    },
  });
  const recurringConfig = input.config.recurringConfig;
  if (recurringConfig === undefined) {
    throw new ConvexError("Recurring payment field is missing recurringConfig");
  }
  return {
    ...oneTimeRequest,
    recurringPayableId: undefined,
    merchantAccountId,
    currency: resolveCurrency(input.config),
    taxMode: input.config.taxEnabled ? "taxable_requires_evidence" : "not_taxable",
    cadence: {
      interval: recurringConfig.interval,
      intervalCount: recurringConfig.intervalCount,
    },
    endPolicy: buildRecurringEndPolicy(input.config),
    startAt: new Date(input.now).toISOString(),
    metadata: {
      ...oneTimeRequest.metadata,
      sealPaymentType: input.config.paymentType,
      sealRecurringInterval: recurringConfig.interval,
      sealRecurringIntervalCount: recurringConfig.intervalCount.toString(),
      sealRecurringEndCondition: recurringConfig.endCondition,
      sealRecurringEndAfterCount: recurringConfig.endAfterCount?.toString() ?? "",
      sealRecurringEndOnDate:
        recurringConfig.endOnDate === undefined
          ? ""
          : new Date(recurringConfig.endOnDate).toISOString(),
    },
  };
}

function addMonthsClamped(startAt: Date, monthOffset: number): string {
  const year = startAt.getUTCFullYear();
  const month = startAt.getUTCMonth() + monthOffset;
  const targetMonthStart = new Date(Date.UTC(year, month, 1));
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(startAt.getUTCDate(), lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      startAt.getUTCHours(),
      startAt.getUTCMinutes(),
      startAt.getUTCSeconds(),
      startAt.getUTCMilliseconds(),
    ),
  ).toISOString();
}

function addInstallmentInterval(
  startAt: string,
  interval: "week" | "month",
  installmentIndex: number,
): string {
  const date = new Date(startAt);
  if (interval === "week") {
    date.setUTCDate(date.getUTCDate() + installmentIndex * 7);
    return date.toISOString();
  } else {
    return addMonthsClamped(date, installmentIndex);
  }
}

function splitInstallmentAmounts(totalAmountCents: number, count: number): readonly number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new ConvexError("Installment count must be a positive integer");
  }
  const baseAmount = Math.floor(totalAmountCents / count);
  const amounts = Array.from({ length: count }, (_, index) => {
    if (index === count - 1) {
      return totalAmountCents - baseAmount * (count - 1);
    }
    return baseAmount;
  });
  if (amounts.some((amount) => amount <= 0)) {
    throw new ConvexError("Installment amounts must be positive");
  }
  return amounts;
}

export function buildCreateInstallmentPayableRequest(input: {
  readonly config: PaymentFieldConfig;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreateInstallmentPayableRequest {
  assertInstallmentPayment(input.config);
  const merchantAccountId = resolveMerchantAccountId(input.env, input.config.organizationId);
  if (merchantAccountId.length === 0) {
    throw new ConvexError(
      `Missing Vortex merchant account mapping for organization ${input.config.organizationId}. Set VORTEX_BILLING_MERCHANT_ACCOUNT_MAP or VORTEX_BILLING_MERCHANT_ACCOUNT_ID.`,
    );
  }
  const oneTimeRequest = buildCreatePayableRequest({
    ...input,
    config: {
      ...input.config,
      paymentType: "one_time",
    },
  });
  const installmentsConfig = input.config.installmentsConfig;
  if (installmentsConfig === undefined) {
    throw new ConvexError("Installment payment field is missing installmentsConfig");
  }
  if (installmentsConfig.firstPaymentAmount !== undefined) {
    throw new ConvexError(
      "Vortex Billing installment bridge requires equal installment price mapping before migrating custom first-payment amounts",
    );
  }
  const dueAt = resolveDueAt(input.config, input.now) ?? new Date(input.now).toISOString();
  const amounts = splitInstallmentAmounts(input.config.totalAmountCents, installmentsConfig.count);
  const baseLineItems = buildLineItems(input.config, input.env);
  return {
    ...oneTimeRequest,
    installmentPayableId: undefined,
    merchantAccountId,
    currency: resolveCurrency(input.config),
    taxMode: input.config.taxEnabled ? "taxable_requires_evidence" : "not_taxable",
    installments: amounts.map((amountDue, index) => ({
      installmentNumber: index + 1,
      role: "installment",
      dueAt: addInstallmentInterval(dueAt, installmentsConfig.interval, index),
      amountDue,
      lineItems: baseLineItems.map((line) => ({
        ...line,
        metadata: {
          ...line.metadata,
          sealInstallmentNumber: (index + 1).toString(),
          sealInstallmentAmountDueCents: amountDue.toString(),
        },
      })),
    })),
    metadata: {
      ...oneTimeRequest.metadata,
      sealPaymentType: input.config.paymentType,
      sealInstallmentsCount: installmentsConfig.count.toString(),
      sealInstallmentsInterval: installmentsConfig.interval,
      sealInstallmentsFirstPaymentAmount: "",
    },
  };
}

export function buildCreateDepositBalancePayableRequest(input: {
  readonly config: PaymentFieldConfig;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreateDepositBalancePayableRequest {
  assertDepositBalancePayment(input.config);
  const merchantAccountId = resolveMerchantAccountId(input.env, input.config.organizationId);
  if (merchantAccountId.length === 0) {
    throw new ConvexError(
      `Missing Vortex merchant account mapping for organization ${input.config.organizationId}. Set VORTEX_BILLING_MERCHANT_ACCOUNT_MAP or VORTEX_BILLING_MERCHANT_ACCOUNT_ID.`,
    );
  }
  const billingAccountId = resolveBillingAccountId(input.env, input.config.organizationId);
  if (billingAccountId.length === 0) {
    throw new ConvexError(
      `Missing Vortex billing account mapping for organization ${input.config.organizationId}. Set VORTEX_BILLING_ACCOUNT_MAP or VORTEX_BILLING_ACCOUNT_ID.`,
    );
  }
  const depositBalanceConfig = input.config.depositBalanceConfig;
  if (depositBalanceConfig === undefined) {
    throw new ConvexError("Deposit/balance payment field is missing depositBalanceConfig");
  }
  if (depositBalanceConfig.depositPercent <= 0 || depositBalanceConfig.depositPercent >= 100) {
    throw new ConvexError("Deposit percentage must be between 1 and 99");
  }
  if (depositBalanceConfig.balanceDueDays < 1) {
    throw new ConvexError("Balance due days must be at least 1");
  }
  const depositAmount = Math.round(
    input.config.totalAmountCents * (depositBalanceConfig.depositPercent / 100),
  );
  const balanceAmount = input.config.totalAmountCents - depositAmount;
  if (depositAmount <= 0 || balanceAmount <= 0) {
    throw new ConvexError("Deposit/balance amounts must be positive");
  }
  const depositDueAt = new Date(input.now).toISOString();
  const balanceDueAt = new Date(
    input.now + depositBalanceConfig.balanceDueDays * 86_400_000,
  ).toISOString();
  return {
    sourceType: "document_payment_field",
    sourceId: sourceIdForConfig(input.config, input.env),
    documentId: input.config.documentId.toString(),
    paymentFieldId: input.config.fieldId.toString(),
    customerExternalId: resolveCustomerExternalId(input.env, input.recipient),
    billingAccountId,
    collectionIntent: "manual",
    feePolicy: buildFeePolicy(input.config),
    depositBalancePayableId: undefined,
    merchantAccountId,
    currency: resolveCurrency(input.config),
    taxMode: input.config.taxEnabled ? "taxable_requires_evidence" : "not_taxable",
    deposit: {
      dueAt: depositDueAt,
      amountDue: depositAmount,
      lineItems: buildLineItemsWithPriceMapSuffix(
        input.config,
        input.env,
        "deposit",
        depositAmount,
      ),
    },
    balance: {
      dueAt: balanceDueAt,
      amountDue: balanceAmount,
      lineItems: buildLineItemsWithPriceMapSuffix(
        input.config,
        input.env,
        "balance",
        balanceAmount,
      ),
    },
    metadata: {
      sourceSystem: "seal",
      vortexMerchantAccountId: merchantAccountId,
      sealDocumentId: input.config.documentId.toString(),
      sealPaymentFieldConfigId: input.config._id.toString(),
      sealPaymentFieldId: input.config.fieldId.toString(),
      sealRecipientEmail: input.recipient.email,
      sealRecipientName: input.recipient.name ?? "",
      sealPaymentType: input.config.paymentType,
      sealTotalAmountCents: input.config.totalAmountCents.toString(),
      sealCurrency: input.config.currency,
      sealDepositPercent: depositBalanceConfig.depositPercent.toString(),
      sealDepositAmountCents: depositAmount.toString(),
      sealBalanceAmountCents: balanceAmount.toString(),
      sealBalanceDueDays: depositBalanceConfig.balanceDueDays.toString(),
    },
  };
}

function readStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ConvexError(`Vortex merchant readiness response ${field} must be an array`);
  }
  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new ConvexError(`Vortex merchant readiness response ${field} entries must be strings`);
    }
    return entry;
  });
}

function readVortexMerchantReadiness(value: unknown): VortexMerchantReadiness {
  if (!isJsonObject(value) || !isJsonObject(value.data)) {
    throw new ConvexError("Vortex merchant readiness response did not include data");
  }
  const data = value.data;
  if (typeof data.merchantAccountId !== "string" || data.merchantAccountId.length === 0) {
    throw new ConvexError("Vortex merchant readiness response did not include merchantAccountId");
  }
  if (typeof data.merchantStatus !== "string" || data.merchantStatus.length === 0) {
    throw new ConvexError("Vortex merchant readiness response did not include merchantStatus");
  }
  if (typeof data.canAcceptPayments !== "boolean") {
    throw new ConvexError("Vortex merchant readiness response did not include canAcceptPayments");
  }
  if (typeof data.payoutReadiness !== "string" || data.payoutReadiness.length === 0) {
    throw new ConvexError("Vortex merchant readiness response did not include payoutReadiness");
  }
  return {
    merchantAccountId: data.merchantAccountId,
    merchantStatus: data.merchantStatus,
    canAcceptPayments: data.canAcceptPayments,
    payoutReadiness: data.payoutReadiness,
    openRequirementIds: readStringArray(data.openRequirementIds, "openRequirementIds"),
    activeCapabilityKeys: readStringArray(data.activeCapabilityKeys, "activeCapabilityKeys"),
    restrictedCapabilityKeys: readStringArray(
      data.restrictedCapabilityKeys,
      "restrictedCapabilityKeys",
    ),
  };
}

async function requireVortexMerchantReady(
  env: VortexBillingEnv,
  merchantAccountId: string,
): Promise<VortexMerchantReadiness> {
  const response = await fetch(
    `${env.apiBaseUrl}/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/state?environment=${env.paymentsEnvironment}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${env.apiKey}`,
        "x-vortex-service": "billing",
      },
    },
  );
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new ConvexError(
      `Vortex merchant readiness check failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  const readiness = readVortexMerchantReadiness(body);
  if (readiness.merchantAccountId !== merchantAccountId) {
    throw new ConvexError(
      `Vortex merchant readiness returned ${readiness.merchantAccountId} for requested ${merchantAccountId}`,
    );
  }
  if (!readiness.canAcceptPayments) {
    throw new ConvexError(
      `Vortex merchant ${merchantAccountId} cannot accept payments: status=${readiness.merchantStatus}, payoutReadiness=${readiness.payoutReadiness}, openRequirements=${readiness.openRequirementIds.join(",")}`,
    );
  }
  return readiness;
}

function readPaymentFieldRecipient(
  config: PaymentFieldConfig,
  fieldMap: ReadonlyMap<string, Doc<"signature_fields">>,
  recipientMap: ReadonlyMap<string, Doc<"document_recipients">>,
): PaymentRecipient {
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

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readOptionalNestedString(
  value: Record<string, unknown>,
  objectKey: string,
  fieldKey: string,
): string | undefined {
  const nested = value[objectKey];
  if (!isJsonObject(nested)) {
    return undefined;
  }
  const fieldValue = nested[fieldKey];
  return typeof fieldValue === "string" && fieldValue.length > 0 ? fieldValue : undefined;
}

function readVortexCreatePayableResult(value: unknown): VortexCreatePayableResult {
  if (!isJsonObject(value) || !isJsonObject(value.data) || !isJsonObject(value.data.payable)) {
    throw new ConvexError("Vortex Billing payable response did not include data.payable");
  }

  const payable = value.data.payable;
  const payableId = payable.payableId;
  if (typeof payableId !== "string" || payableId.length === 0) {
    throw new ConvexError("Vortex Billing payable response did not include payableId");
  }

  const checkoutUrl =
    isJsonObject(payable.lineage) && typeof payable.lineage.checkoutUrl === "string"
      ? payable.lineage.checkoutUrl
      : null;
  const paymentRequestId =
    isJsonObject(payable.lineage) && typeof payable.lineage.paymentRequestId === "string"
      ? payable.lineage.paymentRequestId
      : undefined;

  return {
    recurringPayableId: readOptionalNestedString(
      value.data,
      "recurringPayable",
      "recurringPayableId",
    ),
    installmentPayableId: readOptionalNestedString(
      value.data,
      "installmentPayable",
      "installmentPayableId",
    ),
    depositBalancePayableId: readOptionalNestedString(
      value.data,
      "depositBalancePayable",
      "depositBalancePayableId",
    ),
    payableId,
    checkoutUrl,
    paymentRequestId,
  };
}

async function createVortexPayable(
  env: VortexBillingEnv,
  request: CreatePayableRequest,
  idempotencyKey: string,
): Promise<VortexCreatePayableResult> {
  const response = await fetch(`${env.apiBaseUrl}/v1/payables`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.apiKey}`,
      "idempotency-key": idempotencyKey,
      "x-vortex-service": "billing",
    },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new ConvexError(
      `Vortex Billing payable creation failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return readVortexCreatePayableResult(body);
}

async function createVortexRecurringPayable(
  env: VortexBillingEnv,
  request: CreateRecurringPayableRequest,
  idempotencyKey: string,
): Promise<VortexCreatePayableResult> {
  const response = await fetch(`${env.apiBaseUrl}/v1/recurring-payables`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.apiKey}`,
      "idempotency-key": idempotencyKey,
      "x-vortex-service": "billing",
    },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new ConvexError(
      `Vortex Billing recurring payable creation failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return readVortexCreatePayableResult(body);
}

async function createVortexInstallmentPayable(
  env: VortexBillingEnv,
  request: CreateInstallmentPayableRequest,
  idempotencyKey: string,
): Promise<VortexCreatePayableResult> {
  const response = await fetch(`${env.apiBaseUrl}/v1/installment-payables`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.apiKey}`,
      "idempotency-key": idempotencyKey,
      "x-vortex-service": "billing",
    },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new ConvexError(
      `Vortex Billing installment payable creation failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return readVortexCreatePayableResult(body);
}

async function createVortexDepositBalancePayable(
  env: VortexBillingEnv,
  request: CreateDepositBalancePayableRequest,
  idempotencyKey: string,
): Promise<VortexCreatePayableResult> {
  const response = await fetch(`${env.apiBaseUrl}/v1/deposit-balance-payables`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.apiKey}`,
      "idempotency-key": idempotencyKey,
      "x-vortex-service": "billing",
    },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new ConvexError(
      `Vortex Billing deposit/balance payable creation failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return readVortexCreatePayableResult(body);
}

async function createVortexPayableForConfig(input: {
  readonly config: PaymentFieldConfig;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): Promise<VortexCreatePayableResult> {
  if (input.config.paymentType === "recurring") {
    const request = buildCreateRecurringPayableRequest(input);
    return await createVortexRecurringPayable(
      input.env,
      request,
      `seal:${request.sourceId}:vortex-recurring-payable`,
    );
  }
  if (input.config.paymentType === "installments") {
    const request = buildCreateInstallmentPayableRequest(input);
    return await createVortexInstallmentPayable(
      input.env,
      request,
      `seal:${request.sourceId}:vortex-installment-payable`,
    );
  }
  if (input.config.paymentType === "deposit_balance") {
    const request = buildCreateDepositBalancePayableRequest(input);
    return await createVortexDepositBalancePayable(
      input.env,
      request,
      `seal:${request.sourceId}:vortex-deposit-balance-payable`,
    );
  }
  const request = buildCreatePayableRequest(input);
  return await createVortexPayable(input.env, request, `seal:${request.sourceId}:vortex-payable`);
}

export const createVortexPayablesForPaymentFields = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ invoiceLinks: VortexPayableLink[] }> => {
    const env = readVortexBillingEnv({
      apiBaseUrl: process.env.VORTEX_BILLING_API_BASE_URL,
      apiKey: process.env.VORTEX_BILLING_API_KEY,
      sourceNamespace: process.env.VORTEX_BILLING_SOURCE_NAMESPACE,
      customerMapJson: process.env.VORTEX_BILLING_CUSTOMER_MAP,
      billingAccountMapJson: process.env.VORTEX_BILLING_ACCOUNT_MAP,
      defaultBillingAccountId: process.env.VORTEX_BILLING_ACCOUNT_ID,
      merchantAccountMapJson: process.env.VORTEX_BILLING_MERCHANT_ACCOUNT_MAP,
      defaultMerchantAccountId: process.env.VORTEX_BILLING_MERCHANT_ACCOUNT_ID,
      paymentsEnvironment: process.env.VORTEX_BILLING_PAYMENTS_ENVIRONMENT,
      priceMapJson: process.env.VORTEX_BILLING_PRICE_MAP,
    });
    const merchantAccountId = resolveMerchantAccountId(env, args.organizationId);
    if (merchantAccountId.length === 0) {
      throw new ConvexError(
        `Missing Vortex merchant account mapping for organization ${args.organizationId}. Set VORTEX_BILLING_MERCHANT_ACCOUNT_MAP or VORTEX_BILLING_MERCHANT_ACCOUNT_ID.`,
      );
    }
    await requireVortexMerchantReady(env, merchantAccountId);

    const configs: Doc<"payment_field_configs">[] = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId },
    );

    if (configs.length === 0) {
      return { invoiceLinks: [] };
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

    const invoiceLinks: VortexPayableLink[] = [];
    const now = Date.now();
    for (const config of configs) {
      if (config.organizationId !== args.organizationId) {
        throw new ConvexError("Payment config organization mismatch");
      }
      const recipient = readPaymentFieldRecipient(config, fieldMap, recipientMap);
      const result = await createVortexPayableForConfig({
        config,
        recipient,
        env,
        now,
      });
      await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableLink, {
        configId: config._id,
        vortexRecurringPayableId: result.recurringPayableId,
        vortexInstallmentPayableId: result.installmentPayableId,
        vortexDepositBalancePayableId: result.depositBalancePayableId,
        vortexPayableId: result.payableId,
        vortexPaymentRequestId: result.paymentRequestId,
        hostedInvoiceUrl: result.checkoutUrl ?? undefined,
        customerEmail: recipient.email,
        customerName: recipient.name,
      });
      invoiceLinks.push({
        recipientEmail: recipient.email,
        hostedInvoiceUrl: result.checkoutUrl,
        paymentObjectId: result.payableId,
        totalAmountCents: config.totalAmountCents,
        currency: config.currency,
      });
    }

    return { invoiceLinks };
  },
});
