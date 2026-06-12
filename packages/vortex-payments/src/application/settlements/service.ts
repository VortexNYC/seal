import type {
  GetMerchantSettlementQuery,
  ListMerchantSettlementsQuery,
  MerchantSettlementDetail,
  MerchantSettlementList,
} from "./contracts";

export interface SettlementsService {
  listMerchantSettlements(query: ListMerchantSettlementsQuery): Promise<MerchantSettlementList>;
  getMerchantSettlement(query: GetMerchantSettlementQuery): Promise<MerchantSettlementDetail>;
}
