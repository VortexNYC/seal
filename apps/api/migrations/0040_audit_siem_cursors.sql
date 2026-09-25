-- SEA-67: per-org cursor for SIEM / audit stream export via webhooks.
CREATE TABLE `audit_siem_cursors` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
