import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { Settlement } from "../../domain/funds";
import type { SettlementSnapshot } from "../payouts/contracts";
import type {
  GetMerchantSettlementQuery,
  ListMerchantSettlementsQuery,
  MerchantSettlementDetail,
  MerchantSettlementList,
} from "./contracts";
import type { SettlementsService } from "./service";

export interface SettlementsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
}

function toSettlementSnapshot(settlement: Settlement): SettlementSnapshot {
  return {
    id: settlement.id,
    environment: settlement.environment,
    merchantAccountId: settlement.merchantAccountId,
    currency: settlement.currency,
    status: settlement.status,
    grossAmount: settlement.grossAmount,
    feeAmount: settlement.feeAmount,
    refundAmount: settlement.refundAmount,
    adjustmentAmount: settlement.adjustmentAmount,
    netAmount: settlement.netAmount,
    direction: settlement.direction,
    accrualStartAt: settlement.accrualStartAt,
    accrualEndAt: settlement.accrualEndAt,
    autoCloseAt: settlement.autoCloseAt,
    openedAt: settlement.openedAt,
    closedAt: settlement.closedAt,
    approvedAt: settlement.approvedAt,
    createdAt: settlement.createdAt,
    updatedAt: settlement.updatedAt,
  };
}

export function createSettlementsService(
  dependencies: SettlementsServiceDependencies,
): SettlementsService {
  return {
    async listMerchantSettlements(
      query: ListMerchantSettlementsQuery,
    ): Promise<MerchantSettlementList> {
      const settlements = await dependencies.uow.settlements.listByMerchant(
        query.environment,
        query.merchantAccountId,
      );
      const items = settlements
        .filter(
          (settlement) => query.currency === undefined || settlement.currency === query.currency,
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(toSettlementSnapshot);
      return {
        items,
        hasMore: false,
      };
    },

    async getMerchantSettlement(
      query: GetMerchantSettlementQuery,
    ): Promise<MerchantSettlementDetail> {
      const settlement = await dependencies.uow.settlements.getById(query.settlementId, {
        environment: query.environment,
      });
      if (!settlement || settlement.merchantAccountId !== query.merchantAccountId) {
        return null;
      }
      return toSettlementSnapshot(settlement);
    },
  };
}
