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

type VortexPayableLink = {
  readonly recipientEmail: string;
  readonly hostedInvoiceUrl: string | null;
  readonly paymentObjectId: string;
  readonly totalAmountCents: number;
  readonly currency: string;
};

type VortexCreatePayableResult = {
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
  readonly priceMap: ReadonlyMap<string, string>;
};

type VortexBillingEnvInput = {
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly sourceNamespace?: string;
  readonly customerMapJson?: string;
  readonly billingAccountMapJson?: string;
  readonly defaultBillingAccountId?: string;
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

export function buildCreatePayableRequest(input: {
  readonly config: PaymentFieldConfig;
  readonly recipient: PaymentRecipient;
  readonly env: VortexBillingEnv;
  readonly now: number;
}): CreatePayableRequest {
  assertOneTimePayment(input.config);
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
      priceMapJson: process.env.VORTEX_BILLING_PRICE_MAP,
    });

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
      const request = buildCreatePayableRequest({
        config,
        recipient,
        env,
        now,
      });
      const idempotencyKey = `seal:${request.sourceId}:vortex-payable`;
      const result = await createVortexPayable(env, request, idempotencyKey);
      await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableLink, {
        configId: config._id,
        vortexPayableId: result.payableId,
        vortexPaymentRequestId: result.paymentRequestId,
        hostedInvoiceUrl: result.checkoutUrl ?? undefined,
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
