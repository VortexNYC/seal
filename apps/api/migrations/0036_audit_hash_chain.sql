ALTER TABLE `audit_logs` ADD `prev_hash` text;
ALTER TABLE `audit_logs` ADD `entry_hash` text;
ALTER TABLE `audit_logs` ADD `sequence` integer;
CREATE INDEX `auditLogs_organizationId_sequence_idx` ON `audit_logs` (`organization_id`,`sequence`);
CREATE TABLE `audit_chain_tips` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`tip_hash` text NOT NULL,
	`sequence` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
