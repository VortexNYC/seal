ALTER TABLE `recipients` ADD `awaiting_dictation` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recipients` ADD `is_placeholder` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recipients` ADD `dictated_by` text;--> statement-breakpoint
ALTER TABLE `recipients` ADD `dictated_at` integer;--> statement-breakpoint
ALTER TABLE `recipients` ADD `token_hash` text;