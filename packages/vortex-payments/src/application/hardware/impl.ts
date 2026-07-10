import type { MerchantAccountId, PaymentHardwareOrderId } from "../../domain/common";
import type {
  PaymentHardwareOrder,
  PaymentHardwareReturn,
  PaymentHardwareSku,
} from "../../domain/hardware";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type {
  CreatePaymentHardwareOrderCommand,
  PaymentHardwareNextAction,
  PaymentHardwareOrderLineCommand,
  PaymentHardwareOrderLineSnapshot,
  PaymentHardwareOrderPreview,
  PaymentHardwareOrderSnapshot,
  PaymentHardwareReturnSnapshot,
  PaymentHardwareSkuSnapshot,
  PreviewPaymentHardwareOrderCommand,
  UpsertPaymentHardwareSkuCommand,
} from "./contracts";
import type { PaymentHardwareService } from "./service";

export class PaymentHardwareServiceError extends Error {
  readonly code:
    | "invalid_request"
    | "not_found"
    | "conflict"
    | "action_required"
    | "internal_error";
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(
    code: PaymentHardwareServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "PaymentHardwareServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface PaymentHardwareServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly now?: () => string;
  readonly createId?: (prefix: "phsku" | "phord" | "phret" | "idem") => string;
}

interface PaymentHardwareRuntime {
  readonly uow: PaymentsUnitOfWork;
  readonly now: () => string;
  readonly createId: (prefix: "phsku" | "phord" | "phret" | "idem") => string;
}

type ListPaymentHardwareSkusQuery = Parameters<PaymentHardwareService["listSkus"]>[0];
type GetPaymentHardwareOrderQuery = Parameters<PaymentHardwareService["getOrder"]>[0];
type ListPaymentHardwareOrdersQuery = Parameters<PaymentHardwareService["listOrders"]>[0];
type CancelPaymentHardwareOrderCommand = Parameters<PaymentHardwareService["cancelOrder"]>[0];
type RequestPaymentHardwareReturnCommand = Parameters<PaymentHardwareService["requestReturn"]>[0];

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;

function createDefaultId(prefix: "phsku" | "phord" | "phret" | "idem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function requireHardwareRepositories(uow: PaymentsUnitOfWork) {
  if (!uow.paymentHardwareSkus || !uow.paymentHardwareOrders || !uow.paymentHardwareReturns) {
    throw new PaymentHardwareServiceError(
      "internal_error",
      "payment hardware persistence is not configured",
    );
  }
  return {
    skus: uow.paymentHardwareSkus,
    orders: uow.paymentHardwareOrders,
    returns: uow.paymentHardwareReturns,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function hashRequest(value: unknown): string {
  const stable = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

async function withIdempotentResult<TResult>(
  uow: PaymentsUnitOfWork,
  options: {
    readonly environment: CreatePaymentHardwareOrderCommand["environment"];
    readonly scope: string;
    readonly idempotencyKey?: string;
    readonly request: unknown;
    readonly createId: (prefix: "idem") => string;
    readonly now: string;
  },
  work: () => Promise<TResult>,
): Promise<TResult> {
  if (!options.idempotencyKey) {
    return work();
  }
  const requestHash = hashRequest(options.request);
  const existing = await uow.idempotency.getByScopeAndKey(
    options.environment,
    options.scope,
    options.idempotencyKey,
  );
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new PaymentHardwareServiceError(
        "conflict",
        "idempotency key reused with different request",
        {
          details: { scope: options.scope },
        },
      );
    }
    return JSON.parse(existing.responseRef) as TResult;
  }
  const result = await work();
  await uow.idempotency.save({
    id: options.createId("idem"),
    environment: options.environment,
    scope: options.scope,
    idempotencyKey: options.idempotencyKey,
    requestHash,
    responseRef: JSON.stringify(result),
    createdAt: options.now,
    expiresAt: new Date(Date.parse(options.now) + DEFAULT_IDEMPOTENCY_TTL_MS).toISOString(),
  });
  return result;
}

async function ensureMerchantExists(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentHardwareOrderCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<void> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new PaymentHardwareServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
}

function assertPositiveQuantity(line: PaymentHardwareOrderLineCommand): void {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new PaymentHardwareServiceError(
      "invalid_request",
      "hardware order line quantity must be a positive integer",
      {
        details: { skuId: line.skuId },
      },
    );
  }
}

function nextActionForOrder(order: PaymentHardwareOrder): PaymentHardwareNextAction {
  if (order.status === "provider_action_required") {
    return order.providerAction?.action === "cancel_order_in_provider_portal"
      ? "cancel_provider_order"
      : "place_provider_order";
  }
  if (order.status === "ordered" || order.status === "confirmed") {
    return "track_shipment";
  }
  return "none";
}

function toSkuSnapshot(record: PaymentHardwareSku): PaymentHardwareSkuSnapshot {
  return {
    id: record.id,
    skuCode: record.skuCode,
    displayName: record.displayName,
    deviceType: record.deviceType,
    status: record.status,
    unitAmount: record.unitPrice?.amount,
    currency: record.unitPrice?.currency,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toOrderSnapshot(record: PaymentHardwareOrder): PaymentHardwareOrderSnapshot {
  return {
    id: record.id,
    merchantAccountId: record.merchantAccountId,
    status: record.status,
    lines: record.lines,
    shippingAddress: record.shippingAddress,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    providerAction: record.providerAction,
    shipment: record.shipment,
    cancellationReason: record.cancellationReason,
    refundId: record.refundId,
    metadata: record.metadata,
    nextAction: nextActionForOrder(record),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    orderedAt: record.orderedAt,
    confirmedAt: record.confirmedAt,
    canceledAt: record.canceledAt,
  };
}

function toReturnSnapshot(record: PaymentHardwareReturn): PaymentHardwareReturnSnapshot {
  return {
    id: record.id,
    merchantAccountId: record.merchantAccountId,
    orderId: record.orderId,
    status: record.status,
    lines: record.lines,
    reason: record.reason,
    refundId: record.refundId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function resolveOrderLines(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentHardwareOrderCommand["environment"],
  lines: readonly PaymentHardwareOrderLineCommand[],
): Promise<readonly PaymentHardwareOrderLineSnapshot[]> {
  if (lines.length === 0) {
    throw new PaymentHardwareServiceError(
      "invalid_request",
      "hardware order requires at least one line",
    );
  }
  const resolved: PaymentHardwareOrderLineSnapshot[] = [];
  for (const line of lines) {
    assertPositiveQuantity(line);
    const sku = await requireHardwareRepositories(uow).skus.getById(line.skuId, { environment });
    if (!sku) {
      throw new PaymentHardwareServiceError("not_found", "payment hardware SKU not found", {
        details: { skuId: line.skuId },
      });
    }
    if (sku.status !== "active") {
      throw new PaymentHardwareServiceError(
        "action_required",
        "payment hardware SKU is not active",
        {
          details: { skuId: line.skuId, nextAction: "select_active_sku" },
        },
      );
    }
    resolved.push({
      skuId: sku.id,
      quantity: line.quantity,
      unitAmount: sku.unitPrice?.amount,
      currency: sku.unitPrice?.currency,
    });
  }
  return resolved;
}

function computeSubtotal(lines: readonly PaymentHardwareOrderLineSnapshot[]): {
  readonly amount?: number;
  readonly currency?: "USD" | "CAD";
} {
  const pricedLines = lines.filter(
    (line) => line.unitAmount !== undefined && line.currency !== undefined,
  );
  if (pricedLines.length !== lines.length || pricedLines.length === 0) {
    return {};
  }
  const currency = pricedLines[0]?.currency;
  if (!currency || pricedLines.some((line) => line.currency !== currency)) {
    return {};
  }
  return {
    amount: pricedLines.reduce((total, line) => total + (line.unitAmount ?? 0) * line.quantity, 0),
    currency,
  };
}

async function getOrderInScope(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentHardwareOrderCommand["environment"],
  merchantAccountId: MerchantAccountId,
  orderId: PaymentHardwareOrderId,
): Promise<PaymentHardwareOrder> {
  const order = await requireHardwareRepositories(uow).orders.getById(orderId, { environment });
  if (!order || order.merchantAccountId !== merchantAccountId) {
    throw new PaymentHardwareServiceError("not_found", "payment hardware order not found", {
      details: { orderId },
    });
  }
  return order;
}

async function upsertPaymentHardwareSku(
  runtime: PaymentHardwareRuntime,
  command: UpsertPaymentHardwareSkuCommand,
): Promise<PaymentHardwareSkuSnapshot> {
  const timestamp = runtime.now();
  const repos = requireHardwareRepositories(runtime.uow);
  const existing = await repos.skus.getBySkuCode(command.environment, command.skuCode);
  const record: PaymentHardwareSku = {
    id: existing?.id ?? runtime.createId("phsku"),
    environment: command.environment,
    skuCode: command.skuCode,
    displayName: command.displayName,
    deviceType: command.deviceType,
    status: command.status ?? "active",
    unitPrice:
      command.unitAmount !== undefined && command.currency !== undefined
        ? { amount: command.unitAmount, currency: command.currency }
        : undefined,
    metadata: command.metadata,
    processorRefs: existing?.processorRefs ?? [],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await repos.skus.save(record);
  return toSkuSnapshot(record);
}

async function listPaymentHardwareSkus(
  runtime: PaymentHardwareRuntime,
  query: ListPaymentHardwareSkusQuery,
): Promise<readonly PaymentHardwareSkuSnapshot[]> {
  const records = await requireHardwareRepositories(runtime.uow).skus.list(query.environment);
  return records
    .filter((record) => !query.status || record.status === query.status)
    .map(toSkuSnapshot);
}

async function previewPaymentHardwareOrder(
  runtime: PaymentHardwareRuntime,
  command: PreviewPaymentHardwareOrderCommand,
): Promise<PaymentHardwareOrderPreview> {
  await ensureMerchantExists(runtime.uow, command.environment, command.merchantAccountId);
  const lines = await resolveOrderLines(runtime.uow, command.environment, command.lines);
  const subtotal = computeSubtotal(lines);
  return {
    merchantAccountId: command.merchantAccountId,
    lines,
    subtotalAmount: subtotal.amount,
    currency: subtotal.currency,
    nextAction: "place_provider_order",
    providerAction: {
      rail: "finix_device_store",
      action: "place_order_in_provider_portal",
      reason:
        "Finix production device ordering is dashboard-managed, sandbox ordering is not replicable, and there is no customer-facing device store.",
    },
  };
}

async function createPaymentHardwareOrder(
  runtime: PaymentHardwareRuntime,
  command: CreatePaymentHardwareOrderCommand,
): Promise<PaymentHardwareOrderSnapshot> {
  const timestamp = runtime.now();
  return withIdempotentResult(
    runtime.uow,
    {
      environment: command.environment,
      scope: `payment_hardware_order:${command.merchantAccountId}`,
      idempotencyKey: command.idempotencyKey,
      request: command,
      createId: (prefix) => runtime.createId(prefix),
      now: timestamp,
    },
    async () => {
      const preview = await previewPaymentHardwareOrder(runtime, command);
      const order: PaymentHardwareOrder = {
        id: runtime.createId("phord"),
        environment: command.environment,
        merchantAccountId: command.merchantAccountId,
        status: "provider_action_required",
        lines: preview.lines,
        shippingAddress: command.shippingAddress,
        contactEmail: command.contactEmail,
        contactPhone: command.contactPhone,
        providerAction: preview.providerAction,
        shipment: { status: "not_shipped" },
        metadata: command.metadata,
        processorRefs: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await requireHardwareRepositories(runtime.uow).orders.save(order);
      return toOrderSnapshot(order);
    },
  );
}

async function getPaymentHardwareOrder(
  runtime: PaymentHardwareRuntime,
  query: GetPaymentHardwareOrderQuery,
): Promise<PaymentHardwareOrderSnapshot | null> {
  const order = await requireHardwareRepositories(runtime.uow).orders.getById(query.orderId, {
    environment: query.environment,
  });
  if (!order || order.merchantAccountId !== query.merchantAccountId) {
    return null;
  }
  return toOrderSnapshot(order);
}

async function listPaymentHardwareOrders(
  runtime: PaymentHardwareRuntime,
  query: ListPaymentHardwareOrdersQuery,
): Promise<readonly PaymentHardwareOrderSnapshot[]> {
  const records = await requireHardwareRepositories(runtime.uow).orders.listByMerchant(
    query.environment,
    query.merchantAccountId,
  );
  return records
    .filter((record) => !query.status || record.status === query.status)
    .map(toOrderSnapshot);
}

async function cancelPaymentHardwareOrder(
  runtime: PaymentHardwareRuntime,
  command: CancelPaymentHardwareOrderCommand,
): Promise<PaymentHardwareOrderSnapshot> {
  const timestamp = runtime.now();
  const order = await getOrderInScope(
    runtime.uow,
    command.environment,
    command.merchantAccountId,
    command.orderId,
  );
  if (order.status === "shipped" || order.status === "returned") {
    throw new PaymentHardwareServiceError(
      "conflict",
      "payment hardware order cannot be canceled after shipment or return",
      {
        details: { orderId: order.id, status: order.status },
      },
    );
  }
  if (order.status === "canceled") {
    return toOrderSnapshot(order);
  }
  const canceled: PaymentHardwareOrder = {
    ...order,
    status: "canceled",
    cancellationReason: command.reason,
    providerAction:
      order.status === "provider_action_required"
        ? undefined
        : {
            rail: "finix_device_store",
            action: "cancel_order_in_provider_portal",
            reason:
              "Provider rail cancellation is dashboard/support-managed for payment-device orders.",
          },
    updatedAt: timestamp,
    canceledAt: timestamp,
  };
  await requireHardwareRepositories(runtime.uow).orders.save(canceled);
  return toOrderSnapshot(canceled);
}

async function requestPaymentHardwareReturn(
  runtime: PaymentHardwareRuntime,
  command: RequestPaymentHardwareReturnCommand,
): Promise<PaymentHardwareReturnSnapshot> {
  const timestamp = runtime.now();
  return withIdempotentResult(
    runtime.uow,
    {
      environment: command.environment,
      scope: `payment_hardware_return:${command.orderId}`,
      idempotencyKey: command.idempotencyKey,
      request: command,
      createId: (prefix) => runtime.createId(prefix),
      now: timestamp,
    },
    async () => {
      const order = await getOrderInScope(
        runtime.uow,
        command.environment,
        command.merchantAccountId,
        command.orderId,
      );
      if (
        order.status !== "shipped" &&
        order.status !== "confirmed" &&
        order.status !== "ordered"
      ) {
        throw new PaymentHardwareServiceError(
          "conflict",
          "payment hardware return requires an order in provider fulfillment",
          {
            details: { orderId: order.id, status: order.status },
          },
        );
      }
      const lines = await resolveOrderLines(runtime.uow, command.environment, command.lines);
      const hardwareReturn: PaymentHardwareReturn = {
        id: runtime.createId("phret"),
        environment: command.environment,
        merchantAccountId: command.merchantAccountId,
        orderId: command.orderId,
        status: "requested",
        lines,
        reason: command.reason,
        refundId: command.refundId,
        processorRefs: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await requireHardwareRepositories(runtime.uow).returns.save(hardwareReturn);
      return toReturnSnapshot(hardwareReturn);
    },
  );
}

export function createPaymentHardwareService(
  dependencies: PaymentHardwareServiceDependencies,
): PaymentHardwareService {
  const runtime: PaymentHardwareRuntime = {
    uow: dependencies.uow,
    now: dependencies.now ?? (() => new Date().toISOString()),
    createId: dependencies.createId ?? createDefaultId,
  };

  return {
    async upsertSku(command) {
      return upsertPaymentHardwareSku(runtime, command);
    },
    async listSkus(query) {
      return listPaymentHardwareSkus(runtime, query);
    },
    async previewOrder(command) {
      return previewPaymentHardwareOrder(runtime, command);
    },
    async createOrder(command) {
      return createPaymentHardwareOrder(runtime, command);
    },
    async getOrder(query) {
      return getPaymentHardwareOrder(runtime, query);
    },
    async listOrders(query) {
      return listPaymentHardwareOrders(runtime, query);
    },
    async cancelOrder(command) {
      return cancelPaymentHardwareOrder(runtime, command);
    },
    async requestReturn(command) {
      return requestPaymentHardwareReturn(runtime, command);
    },
  };
}
