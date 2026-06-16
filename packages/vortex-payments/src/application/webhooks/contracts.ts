import type {
  Environment,
  RawProcessorWebhookId,
} from "../../domain/common";
import type { ProviderKey } from "../../providers/types";

export interface IngestProviderWebhookCommand {
  readonly environment: Environment;
  readonly provider: ProviderKey;
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: string;
  readonly receivedAt: string;
}

export interface WebhookIngestionResult {
  readonly rawWebhookId: RawProcessorWebhookId;
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly signatureStatus: "valid" | "invalid" | "skipped";
  readonly signatureReason?: string;
}
