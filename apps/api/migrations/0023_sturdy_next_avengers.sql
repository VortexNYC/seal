CREATE TABLE `vortex_billing_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vortex_billing_webhook_events_event_id_unique` ON `vortex_billing_webhook_events` (`event_id`);--> statement-breakpoint
CREATE INDEX `vortexBillingWebhookEvents_eventId_idx` ON `vortex_billing_webhook_events` (`event_id`);