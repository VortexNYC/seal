import type { Environment, MerchantAccountId, PaymentId, RefundId } from "../../domain/common";
import type { RefundStatus } from "../../domain/payments";

export interface CreateRefundCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentId: PaymentId;
  readonly amount: number;
  readonly reason: string;
  readonly requestedByType: "system" | "operator" | "merchant";
  readonly requestedByRef: string;
  readonly idempotencyKey?: string;
}

export interface RefundSnapshot {
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

export interface GetRefundQuery {
  readonly environment: Environment;
  readonly refundId: RefundId;
}
