CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`result` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `jobs_public_id_unique` ON `jobs` (`public_id`);
CREATE INDEX `jobs_orgStatus_idx` ON `jobs` (`organization_id`,`status`);
