import type {
  CurrencyCode,
  Environment,
  MerchantAccountId,
  Metadata,
  PaymentHardwareOrderId,
  PaymentHardwareSkuId,
} from "../../domain/common";
import type {
  PaymentHardwareOrderStatus,
  PaymentHardwareProviderAction,
  PaymentHardwareReturnStatus,
  PaymentHardwareShipment,
  PaymentHardwareSkuStatus,
} from "../../domain/hardware";
import type { TerminalAddress } from "../../domain/terminal";

export type PaymentHardwareNextAction =
  | "none"
  | "select_active_sku"
  | "place_provider_order"
  | "cancel_provider_order"
  | "contact_provider"
  | "track_shipment";

export interface UpsertPaymentHardwareSkuCommand {
  readonly environment: Environment;
  readonly skuCode: string;
  readonly displayName: string;
  readonly deviceType: string;
  readonly status?: PaymentHardwareSkuStatus;
  readonly unitAmount?: number;
  readonly currency?: CurrencyCode;
  readonly metadata?: Metadata;
  readonly idempotencyKey?: string;
}

export interface PaymentHardwareSkuSnapshot {
  readonly id: PaymentHardwareSkuId;
  readonly skuCode: string;
  readonly displayName: string;
  readonly deviceType: string;
  readonly status: PaymentHardwareSkuStatus;
  readonly unitAmount?: number;
  readonly currency?: CurrencyCode;
  readonly metadata?: Metadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListPaymentHardwareSkusQuery {
  readonly environment: Environment;
  readonly status?: PaymentHardwareSkuStatus;
}

export interface PaymentHardwareOrderLineCommand {
  readonly skuId: PaymentHardwareSkuId;
  readonly quantity: number;
}

export interface PaymentHardwareOrderLineSnapshot {
  readonly skuId: PaymentHardwareSkuId;
  readonly quantity: number;
  readonly unitAmount?: number;
  readonly currency?: CurrencyCode;
}

export interface PreviewPaymentHardwareOrderCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly lines: readonly PaymentHardwareOrderLineCommand[];
  readonly shippingAddress: TerminalAddress;
}

export interface PaymentHardwareOrderPreview {
  readonly merchantAccountId: MerchantAccountId;
  readonly lines: readonly PaymentHardwareOrderLineSnapshot[];
  readonly subtotalAmount?: number;
  readonly currency?: CurrencyCode;
  readonly nextAction: PaymentHardwareNextAction;
  readonly providerAction: PaymentHardwareProviderAction;
}

export interface CreatePaymentHardwareOrderCommand extends PreviewPaymentHardwareOrderCommand {
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly metadata?: Metadata;
  readonly idempotencyKey?: string;
}

export interface PaymentHardwareOrderSnapshot {
  readonly id: PaymentHardwareOrderId;
  readonly merchantAccountId: MerchantAccountId;
  readonly status: PaymentHardwareOrderStatus;
  readonly lines: readonly PaymentHardwareOrderLineSnapshot[];
  readonly shippingAddress: TerminalAddress;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly providerAction?: PaymentHardwareProviderAction;
  readonly shipment: PaymentHardwareShipment;
  readonly cancellationReason?: string;
  readonly refundId?: string;
  readonly metadata?: Metadata;
  readonly nextAction: PaymentHardwareNextAction;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orderedAt?: string;
  readonly confirmedAt?: string;
  readonly canceledAt?: string;
}

export interface ListPaymentHardwareOrdersQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly status?: PaymentHardwareOrderStatus;
}

export interface GetPaymentHardwareOrderQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly orderId: PaymentHardwareOrderId;
}

export interface CancelPaymentHardwareOrderCommand extends GetPaymentHardwareOrderQuery {
  readonly reason: string;
}

export interface RequestPaymentHardwareReturnCommand extends GetPaymentHardwareOrderQuery {
  readonly lines: readonly PaymentHardwareOrderLineCommand[];
  readonly reason: string;
  readonly refundId?: string;
  readonly idempotencyKey?: string;
}

export interface PaymentHardwareReturnSnapshot {
  readonly id: string;
  readonly merchantAccountId: MerchantAccountId;
  readonly orderId: PaymentHardwareOrderId;
  readonly status: PaymentHardwareReturnStatus;
  readonly lines: readonly PaymentHardwareOrderLineSnapshot[];
  readonly reason: string;
  readonly refundId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
