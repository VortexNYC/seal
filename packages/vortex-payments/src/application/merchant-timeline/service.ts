import type { ListMerchantTimelineQuery, MerchantTimelineList } from "./contracts";

export interface MerchantTimelineService {
  listMerchantTimeline(query: ListMerchantTimelineQuery): Promise<MerchantTimelineList>;
}
