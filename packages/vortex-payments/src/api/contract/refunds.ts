import type { MerchantAccountId, PaymentId, RefundId } from "../../domain/common";
import type { RefundStatus } from "../../domain/payments";
import type { CursorPage, MetadataCarrier } from "./common";

export interface CreateRefundRequest extends MetadataCarrier {
  readonly paymentId: PaymentId;
  readonly amount: number;
  readonly reason: string;
}

export interface ApiRefundSnapshot {
  readonly id: RefundId;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentId: PaymentId;
  readonly amount: number;
  readonly currency: string;
  readonly status: RefundStatus;
  readonly reason: string;
  readonly terminalSessionId?: string;
  readonly terminalReaderId?: string;
}

export interface RefundListResponse extends CursorPage<ApiRefundSnapshot> {}
