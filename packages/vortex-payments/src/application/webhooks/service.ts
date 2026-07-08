import type { IngestProviderWebhookCommand, WebhookIngestionResult } from "./contracts";

export interface WebhooksService {
  ingestProviderWebhook(command: IngestProviderWebhookCommand): Promise<WebhookIngestionResult>;
}
