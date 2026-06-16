import type { CreateRefundCommand, GetRefundQuery, RefundSnapshot } from "./contracts";

export interface RefundsService {
  createRefund(command: CreateRefundCommand): Promise<RefundSnapshot>;
  getRefund(query: GetRefundQuery): Promise<RefundSnapshot | null>;
}
