import type { Environment, MerchantAccountId } from "../../domain/common";
import type { CanonicalEventType } from "../../events/types";

export interface ListMerchantTimelineQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly limit?: number;
}

export interface MerchantTimelineItem {
  readonly id: string;
  readonly eventType: CanonicalEventType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly sourceProvider: string;
  readonly sourceEventRef?: string;
  readonly correlationId?: string;
  readonly description: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
}

export interface MerchantTimelineList {
  readonly items: readonly MerchantTimelineItem[];
  readonly hasMore: boolean;
}
