ALTER TABLE `documents` ADD `last_expiration_alert_at` integer;
--> statement-breakpoint
ALTER TABLE `recipients` ADD `last_reminded_at` integer;
--> statement-breakpoint
ALTER TABLE `recipients` ADD `reminder_count` integer DEFAULT 0 NOT NULL;
