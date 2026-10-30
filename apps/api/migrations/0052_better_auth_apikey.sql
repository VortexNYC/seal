CREATE TABLE `apikey` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text NOT NULL DEFAULT 'seal',
	`name` text,
	`start` text,
	`reference_id` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer NOT NULL DEFAULT true,
	`rate_limit_enabled` integer NOT NULL DEFAULT false,
	`rate_limit_time_window` integer,
	`rate_limit_max` integer,
	`request_count` integer NOT NULL DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	`updated_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	`permissions` text,
	`metadata` text,
	FOREIGN KEY (`reference_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apikey_key_unique` ON `apikey` (`key`);
--> statement-breakpoint
CREATE INDEX `apikey_configId_idx` ON `apikey` (`config_id`);
--> statement-breakpoint
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);
--> statement-breakpoint
CREATE TABLE `deviceCode` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text
);
