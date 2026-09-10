CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`description` text,
	`secret` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`total_deliveries` integer DEFAULT 0 NOT NULL,
	`successful_deliveries` integer DEFAULT 0 NOT NULL,
	`failed_deliveries` integer DEFAULT 0 NOT NULL,
	`last_delivery_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhooks_public_id_idx` ON `webhooks` (`public_id`);
--> statement-breakpoint
CREATE INDEX `webhooks_organizationId_idx` ON `webhooks` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `webhooks_status_idx` ON `webhooks` (`status`);
