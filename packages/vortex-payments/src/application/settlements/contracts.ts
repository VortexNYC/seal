import type { CurrencyCode, Environment, MerchantAccountId, SettlementId } from "../../domain/common";
import type { SettlementListResponse } from "../../api/contract/payouts";
import type { SettlementSnapshot } from "../payouts/contracts";

export interface ListMerchantSettlementsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly currency?: CurrencyCode;
}

export interface GetMerchantSettlementQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
}

export type MerchantSettlementList = SettlementListResponse<SettlementSnapshot>;
export type MerchantSettlementDetail = SettlementSnapshot | null;
