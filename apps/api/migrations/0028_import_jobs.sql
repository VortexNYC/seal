CREATE TABLE `import_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL UNIQUE,
  `organization_id` text NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `adapter` text NOT NULL,
  `payload` text NOT NULL DEFAULT '{}',
  `status` text NOT NULL DEFAULT 'pending_approval',
  `cursor` text,
  `processed_count` integer NOT NULL DEFAULT 0,
  `total_count` integer,
  `error` text,
  `approved_by` text,
  `approved_at` integer,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX `importJobs_organizationId_idx` ON `import_jobs` (`organization_id`);
CREATE INDEX `importJobs_status_idx` ON `import_jobs` (`status`);
