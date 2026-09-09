CREATE TABLE `activity` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `action` text NOT NULL,
  `actor_name` text NOT NULL,
  `target_name` text,
  `metadata` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX `activity_organizationId_idx` ON `activity` (`organization_id`);
CREATE INDEX `activity_createdAt_idx` ON `activity` (`created_at`);
