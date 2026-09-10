CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source_document_id` text,
	`folder_id` text,
	`storage_key` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`page_count` integer,
	`thumbnail_data_url` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_public_id_unique` ON `templates` (`public_id`);--> statement-breakpoint
CREATE INDEX `templates_organizationId_idx` ON `templates` (`organization_id`);--> statement-breakpoint
CREATE INDEX `templates_createdBy_idx` ON `templates` (`created_by`);--> statement-breakpoint
CREATE INDEX `templates_status_idx` ON `templates` (`status`);--> statement-breakpoint
CREATE INDEX `templates_organizationStatus_idx` ON `templates` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `templates_useCount_idx` ON `templates` (`use_count`);--> statement-breakpoint
CREATE INDEX `templates_folderId_idx` ON `templates` (`folder_id`);--> statement-breakpoint
CREATE TABLE `template_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`template_id` text NOT NULL,
	`field_type` text NOT NULL,
	`label` text,
	`is_required` integer DEFAULT false NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`page` integer NOT NULL,
	`properties` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_fields_public_id_unique` ON `template_fields` (`public_id`);--> statement-breakpoint
CREATE INDEX `templateFields_templateId_idx` ON `template_fields` (`template_id`);--> statement-breakpoint
CREATE INDEX `templateFields_templateIdPage_idx` ON `template_fields` (`template_id`,`page`);--> statement-breakpoint
CREATE INDEX `templateFields_templateIdOrder_idx` ON `template_fields` (`template_id`,`order`);
