import type { Environment, IsoTimestamp, Metadata, RawProcessorWebhookId } from "./common";

export type WebhookEndpointId = string;
export type WebhookDeliveryId = string;
export type EventSubscriptionId = string;

export type WebhookEndpointStatus = "active" | "disabled";

export interface WebhookEndpoint {
  readonly id: WebhookEndpointId;
  readonly environment: Environment;
  readonly destinationUrl: string;
  readonly status: WebhookEndpointStatus;
  readonly secretRef?: string;
  readonly description?: string;
  readonly subscribedEventTypes: readonly string[];
  readonly metadata?: Metadata;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "discarded";

export interface WebhookDelivery {
  readonly id: WebhookDeliveryId;
  readonly environment: Environment;
  readonly endpointId: WebhookEndpointId;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly status: WebhookDeliveryStatus;
  readonly attemptCount: number;
  readonly lastAttemptAt?: IsoTimestamp;
  readonly nextAttemptAt?: IsoTimestamp;
  readonly httpStatusCode?: number;
  readonly failureReason?: string;
  readonly sourceWebhookId?: RawProcessorWebhookId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface EventSubscription {
  readonly id: EventSubscriptionId;
  readonly environment: Environment;
  readonly endpointId: WebhookEndpointId;
  readonly eventType: string;
  readonly active: boolean;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
