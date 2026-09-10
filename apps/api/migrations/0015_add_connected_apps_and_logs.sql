CREATE TABLE `connected_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`connected_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_activity_at` integer,
	`scopes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connectedApps_userId_idx` ON `connected_apps` (`user_id`);--> statement-breakpoint
CREATE INDEX `connectedApps_userIdActive_idx` ON `connected_apps` (`user_id`,`active`);--> statement-breakpoint
CREATE TABLE `integration_activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`integration_name` text NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integrationActivityLogs_userId_idx` ON `integration_activity_logs` (`user_id`);
