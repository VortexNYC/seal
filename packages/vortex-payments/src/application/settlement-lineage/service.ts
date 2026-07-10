import type { SyncSettlementLineageQuery, SyncSettlementLineageResult } from "./contracts";

export interface SettlementLineageService {
  syncSettlementLineage(
    query: SyncSettlementLineageQuery,
  ): Promise<SyncSettlementLineageResult | null>;
}
