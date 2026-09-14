CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auditLogs_organizationId_idx` ON `audit_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `auditLogs_actorType_idx` ON `audit_logs` (`actor_type`);--> statement-breakpoint
CREATE INDEX `auditLogs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `auditLogs_resourceType_idx` ON `audit_logs` (`resource_type`);--> statement-breakpoint
CREATE INDEX `auditLogs_createdAt_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `auditLogs_organizationId_createdAt_idx` ON `audit_logs` (`organization_id`,`created_at`);