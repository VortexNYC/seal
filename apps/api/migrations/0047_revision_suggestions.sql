CREATE TABLE `revision_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`document_id` text NOT NULL,
	`review_cell_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`anchor_quote` text NOT NULL,
	`anchor_page` integer,
	`anchor_bbox` text,
	`proposed_text` text,
	`rationale` text,
	`derived_document_id` text,
	`created_by` text NOT NULL,
	`created_by_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `revision_suggestions_public_id_unique` ON `revision_suggestions` (`public_id`);
CREATE INDEX `revisionSuggestions_doc_idx` ON `revision_suggestions` (`document_id`);
CREATE INDEX `revisionSuggestions_orgStatus_idx` ON `revision_suggestions` (`organization_id`,`status`);
