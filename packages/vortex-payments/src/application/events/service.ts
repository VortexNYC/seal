import type { CanonicalDomainEvent } from "../../events/types";

export interface CanonicalEventsService {
  applyCanonicalEvents(events: readonly CanonicalDomainEvent[]): Promise<void>;
}
