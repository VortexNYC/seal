CREATE TABLE `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_type` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`period` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usageEvents_organizationId_idx` ON `usage_events` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `usageEvents_organizationPeriod_idx` ON `usage_events` (`organization_id`,`period`);
--> statement-breakpoint
CREATE INDEX `usageEvents_organizationEventType_idx` ON `usage_events` (`organization_id`,`event_type`);
