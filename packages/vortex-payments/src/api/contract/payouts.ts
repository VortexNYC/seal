import type { CursorPage } from "./common";

export interface SettlementListResponse<TSettlement> extends CursorPage<TSettlement> {}

export interface PayoutListResponse<TPayout> extends CursorPage<TPayout> {}

export interface RetryPayoutRequest {
  readonly reason?: string;
}

export interface HoldPayoutRequest {
  readonly reason: string;
}

export interface ReleasePayoutRequest {
  readonly reason: string;
}
