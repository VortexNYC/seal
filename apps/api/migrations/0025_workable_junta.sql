CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`external_customer_id` text NOT NULL,
	`external_subscription_id` text NOT NULL,
	`external_price_id` text,
	`external_product_id` text,
	`status` text NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`current_period_start` integer,
	`current_period_end` integer,
	`latest_invoice_id` text,
	`latest_invoice_status` text,
	`canceled_at` integer,
	`cancel_reason` text,
	`past_due_since` integer,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_public_id_unique` ON `subscriptions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_external_subscription_id_unique` ON `subscriptions` (`external_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_organizationId_idx` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_externalSubscriptionId_idx` ON `subscriptions` (`external_subscription_id`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`webhook_id` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 10 NOT NULL,
	`next_retry_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`locked_at` integer,
	`last_error` text,
	`response_status` integer,
	`response_body` text,
	`delivered_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhookDeliveries_organizationId_idx` ON `webhook_deliveries` (`organization_id`);--> statement-breakpoint
CREATE INDEX `webhookDeliveries_webhookId_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `webhookDeliveries_status_nextRetryAt_idx` ON `webhook_deliveries` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `webhookDeliveries_eventId_webhookId_idx` ON `webhook_deliveries` (`event_id`,`webhook_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhookDeliveries_webhookId_eventId_unique` ON `webhook_deliveries` (`webhook_id`,`event_id`);