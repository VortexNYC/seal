CREATE TABLE `review_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`model` text,
	`columns` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `review_packs_public_id_unique` ON `review_packs` (`public_id`);
CREATE INDEX `reviewPacks_org_idx` ON `review_packs` (`organization_id`);
