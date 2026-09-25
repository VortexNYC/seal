CREATE TABLE `audit_health` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`last_failure_at` integer,
	`last_failure_reason` text,
	`last_alert_at` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
