CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_public_id_unique` ON `api_tokens` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `apiTokens_organizationId_idx` ON `api_tokens` (`organization_id`);--> statement-breakpoint
CREATE INDEX `apiTokens_userId_idx` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `apiTokens_tokenHash_idx` ON `api_tokens` (`token_hash`);