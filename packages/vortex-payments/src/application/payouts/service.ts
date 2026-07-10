import type {
  GetMerchantPayoutQuery,
  GetMerchantSellerPayoutProfileQuery,
  GetSettlementFundingTimelineQuery,
  GetSettlementPayoutReadinessQuery,
  ListMerchantPayoutsQuery,
  MerchantPayoutDetail,
  MerchantPayoutList,
  MerchantSellerPayoutProfileDetail,
  SettlementFundingTimelineDetail,
  SettlementPayoutReadinessDetail,
} from "./contracts";

export interface PayoutsService {
  listMerchantPayouts(query: ListMerchantPayoutsQuery): Promise<MerchantPayoutList>;
  getMerchantPayout(query: GetMerchantPayoutQuery): Promise<MerchantPayoutDetail>;
  getMerchantSellerPayoutProfile(
    query: GetMerchantSellerPayoutProfileQuery,
  ): Promise<MerchantSellerPayoutProfileDetail>;
  getSettlementPayoutReadiness(
    query: GetSettlementPayoutReadinessQuery,
  ): Promise<SettlementPayoutReadinessDetail>;
  getSettlementFundingTimeline(
    query: GetSettlementFundingTimelineQuery,
  ): Promise<SettlementFundingTimelineDetail>;
}
