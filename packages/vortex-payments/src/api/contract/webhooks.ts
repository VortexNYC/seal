import type { CanonicalEventType } from "../../events/types";
import type { CursorPage } from "./common";

export interface WebhookSubscription {
  readonly id: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly subscribedEventTypes: readonly CanonicalEventType[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWebhookSubscriptionRequest {
  readonly url: string;
  readonly subscribedEventTypes: readonly CanonicalEventType[];
  readonly secretRef?: string;
}

export interface UpdateWebhookSubscriptionRequest {
  readonly subscribedEventTypes?: readonly CanonicalEventType[];
  readonly enabled?: boolean;
  readonly secretRef?: string;
}

export interface WebhookSubscriptionListResponse extends CursorPage<WebhookSubscription> {}
