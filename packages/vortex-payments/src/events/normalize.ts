import type { CanonicalDomainEvent, ProcessorEvent, RawProcessorWebhook } from "./types";

export interface NormalizationError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface WebhookParseResult {
  readonly processorEntityType: string;
  readonly processorEventType: string;
  readonly processorObjectId: string;
  readonly occurredAt: string;
  readonly payload: string;
}

export interface ProcessorWebhookParser {
  parse(rawWebhook: RawProcessorWebhook): WebhookParseResult;
}

export interface EventNormalizationResult {
  readonly ok: boolean;
  readonly events: readonly CanonicalDomainEvent[];
  readonly error?: NormalizationError;
}

export interface ProcessorEventNormalizer {
  normalize(event: ProcessorEvent): EventNormalizationResult;
}
