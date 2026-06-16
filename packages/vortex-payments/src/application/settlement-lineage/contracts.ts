import type { Environment, MerchantAccountId, SettlementId } from "../../domain/common";
import type { SettlementLineageEntry } from "../../domain/funds";

export interface SyncSettlementLineageQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
}

export interface SyncSettlementLineageResult {
  readonly settlementId: SettlementId;
  readonly provider: string;
  readonly considered: number;
  readonly resolvedPayments: number;
  readonly resolvedRefunds: number;
  readonly unresolved: number;
  readonly entries: readonly SettlementLineageEntry[];
}
