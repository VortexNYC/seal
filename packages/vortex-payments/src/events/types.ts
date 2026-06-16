import type {
  CanonicalDomainEventId,
  Environment,
  IsoTimestamp,
  ProcessorEventId,
  RawProcessorWebhookId,
} from "../domain/common";

export type CanonicalEventType =
  | "merchant_account.created"
  | "merchant_account.updated"
  | "customer.created"
  | "customer.updated"
  | "merchant_account.submitted"
  | "merchant_account.approved"
  | "merchant_account.rejected"
  | "merchant_account.action_required"
  | "merchant_account.restricted"
  | "merchant_state.updated"
  | "merchant_capability.updated"
  | "merchant_requirement.submitted"
  | "merchant_requirement.refreshed"
  | "merchant_requirement_document.upload_link_created"
  | "payment_method.created"
  | "payment_method.updated"
  | "payment.created"
  | "payment.authorized"
  | "payment.captured"
  | "payment.failed"
  | "payment.canceled"
  | "card_present_payment_intent.created"
  | "card_present_payment_intent.captured"
  | "card_present_payment_intent.canceled"
  | "refund.created"
  | "refund.succeeded"
  | "refund.failed"
  | "settlement.accruing_started"
  | "settlement.closed"
  | "settlement.reconciled"
  | "payout.created"
  | "payout.failed"
  | "payout.succeeded"
  | "payout.returned"
  | "payout.reconciled"
  | "dispute.opened"
  | "dispute.action_required"
  | "dispute.won"
  | "dispute.lost"
  | "dispute.reconciled";

export interface RawProcessorWebhook {
  readonly id: RawProcessorWebhookId;
  readonly environment: Environment;
  readonly provider: string;
  readonly deliveryKey: string;
  readonly processorWebhookId?: string;
  readonly processorEntityType: string;
  readonly processorEventType: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: string;
  readonly signatureValidationStatus: "valid" | "invalid" | "skipped";
  readonly processingStatus: "pending" | "accepted" | "duplicate" | "rejected";
  readonly receivedAt: IsoTimestamp;
}

export interface ProcessorEvent {
  readonly id: ProcessorEventId;
  readonly environment: Environment;
  readonly provider: string;
  readonly processorEventId?: string;
  readonly processorEntityType: string;
  readonly processorEventType: string;
  readonly processorObjectId: string;
  readonly occurredAt: IsoTimestamp;
  readonly payload: string;
  readonly rawWebhookId: RawProcessorWebhookId;
  readonly normalizationStatus: "pending" | "normalized" | "failed";
  readonly normalizationError?: string;
  readonly createdAt: IsoTimestamp;
}

export interface CanonicalDomainEvent {
  readonly id: CanonicalDomainEventId;
  readonly environment: Environment;
  readonly eventType: CanonicalEventType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: IsoTimestamp;
  readonly sourceProvider: string;
  readonly sourceEventRef?: ProcessorEventId;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly createdAt: IsoTimestamp;
}
