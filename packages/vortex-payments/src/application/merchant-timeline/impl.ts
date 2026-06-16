import { canonicalEventCatalog } from "../../events/catalog";
import type { CanonicalDomainEvent } from "../../events/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { ListMerchantTimelineQuery, MerchantTimelineItem, MerchantTimelineList } from "./contracts";
import type { MerchantTimelineService } from "./service";

export class MerchantTimelineServiceError extends Error {
  readonly code: "not_found";

  constructor(message: string) {
    super(message);
    this.name = "MerchantTimelineServiceError";
    this.code = "not_found";
  }
}

export interface MerchantTimelineServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly listMerchantTimelineEvents: (input: {
    readonly environment: ListMerchantTimelineQuery["environment"];
    readonly merchantAccountId: ListMerchantTimelineQuery["merchantAccountId"];
    readonly merchantProcessorObjectIds: readonly string[];
    readonly limit: number;
  }) => Promise<readonly CanonicalDomainEvent[]>;
}

function toTimelineItem(event: CanonicalDomainEvent): MerchantTimelineItem {
  const definition = canonicalEventCatalog.find((entry) => entry.type === event.eventType);
  return {
    id: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    occurredAt: event.occurredAt,
    sourceProvider: event.sourceProvider,
    sourceEventRef: event.sourceEventRef,
    correlationId: event.correlationId,
    description: definition?.description ?? event.eventType,
    payload: event.payload,
  };
}

export function createMerchantTimelineService(
  dependencies: MerchantTimelineServiceDependencies,
): MerchantTimelineService {
  return {
    async listMerchantTimeline(query: ListMerchantTimelineQuery): Promise<MerchantTimelineList> {
      const merchant = await dependencies.uow.merchants.getById(query.merchantAccountId, {
        environment: query.environment,
      });
      if (!merchant) {
        throw new MerchantTimelineServiceError("merchant account not found");
      }

      const limit = query.limit ?? 50;
      const events = await dependencies.listMerchantTimelineEvents({
        environment: query.environment,
        merchantAccountId: query.merchantAccountId,
        merchantProcessorObjectIds: merchant.processorAccountRefs.map((ref) => ref.objectId),
        limit,
      });

      return {
        items: events.map(toTimelineItem),
        hasMore: events.length >= limit,
      };
    },
  };
}
