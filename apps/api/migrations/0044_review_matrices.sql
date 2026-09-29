CREATE TABLE `review_matrices` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`columns_config` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_matrices_public_id_unique` ON `review_matrices` (`public_id`);
--> statement-breakpoint
CREATE INDEX `reviewMatrices_organizationId_idx` ON `review_matrices` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `reviewMatrices_ownerId_idx` ON `review_matrices` (`owner_id`);
--> statement-breakpoint
CREATE TABLE `review_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`matrix_id` text NOT NULL,
	`document_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`matrix_id`) REFERENCES `review_matrices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_rows_public_id_unique` ON `review_rows` (`public_id`);
--> statement-breakpoint
CREATE INDEX `reviewRows_matrixId_idx` ON `review_rows` (`matrix_id`);
--> statement-breakpoint
CREATE INDEX `reviewRows_documentId_idx` ON `review_rows` (`document_id`);
--> statement-breakpoint
CREATE TABLE `review_cells` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`row_id` text NOT NULL,
	`column_index` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`summary` text,
	`flag` text,
	`reasoning` text,
	`citations` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`row_id`) REFERENCES `review_rows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_cells_public_id_unique` ON `review_cells` (`public_id`);
--> statement-breakpoint
CREATE INDEX `reviewCells_rowId_idx` ON `review_cells` (`row_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewCells_rowColumn_uidx` ON `review_cells` (`row_id`,`column_index`);
