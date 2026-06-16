import type {
  CurrencyCode,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  Metadata,
  PaymentHardwareOrderId,
  PaymentHardwareReturnId,
  PaymentHardwareSkuId,
  ProcessorRef,
} from "./common";
import type { TerminalAddress } from "./terminal";

export type PaymentHardwareSkuStatus = "active" | "inactive";
export type PaymentHardwareOrderStatus =
  | "draft"
  | "provider_action_required"
  | "ordered"
  | "confirmed"
  | "shipped"
  | "canceled"
  | "returned";
export type PaymentHardwareShipmentStatus = "not_shipped" | "shipped" | "delivered";
export type PaymentHardwareReturnStatus = "requested" | "approved" | "received" | "rejected";
export type PaymentHardwareFulfillmentRail = "finix_device_store" | "manual_provider";

export interface PaymentHardwareMoney {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export interface PaymentHardwareSku {
  readonly id: PaymentHardwareSkuId;
  readonly environment: Environment;
  readonly skuCode: string;
  readonly displayName: string;
  readonly deviceType: string;
  readonly status: PaymentHardwareSkuStatus;
  readonly unitPrice?: PaymentHardwareMoney;
  readonly metadata?: Metadata;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface PaymentHardwareOrderLine {
  readonly skuId: PaymentHardwareSkuId;
  readonly quantity: number;
  readonly unitAmount?: number;
  readonly currency?: CurrencyCode;
}

export interface PaymentHardwareShipment {
  readonly status: PaymentHardwareShipmentStatus;
  readonly carrier?: string;
  readonly trackingNumberMasked?: string;
  readonly shippedAt?: IsoTimestamp;
  readonly deliveredAt?: IsoTimestamp;
}

export interface PaymentHardwareProviderAction {
  readonly rail: PaymentHardwareFulfillmentRail;
  readonly action: "place_order_in_provider_portal" | "cancel_order_in_provider_portal" | "contact_provider";
  readonly reason: string;
}

export interface PaymentHardwareOrder {
  readonly id: PaymentHardwareOrderId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly status: PaymentHardwareOrderStatus;
  readonly lines: readonly PaymentHardwareOrderLine[];
  readonly shippingAddress: TerminalAddress;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly providerAction?: PaymentHardwareProviderAction;
  readonly shipment: PaymentHardwareShipment;
  readonly cancellationReason?: string;
  readonly refundId?: string;
  readonly metadata?: Metadata;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly orderedAt?: IsoTimestamp;
  readonly confirmedAt?: IsoTimestamp;
  readonly canceledAt?: IsoTimestamp;
}

export interface PaymentHardwareReturn {
  readonly id: PaymentHardwareReturnId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly orderId: PaymentHardwareOrderId;
  readonly status: PaymentHardwareReturnStatus;
  readonly lines: readonly PaymentHardwareOrderLine[];
  readonly reason: string;
  readonly refundId?: string;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
