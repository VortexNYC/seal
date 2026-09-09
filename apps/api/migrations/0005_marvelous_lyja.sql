CREATE TABLE `contacts` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL UNIQUE,
  `organization_id` text NOT NULL,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `full_name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text,
  `company` text,
  `title` text,
  `status` text DEFAULT 'active' NOT NULL,
  `notes` text,
  `tags` text,
  `last_contacted_at` integer,
  `created_by` text NOT NULL,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX `contacts_organizationId_idx` ON `contacts` (`organization_id`);
CREATE INDEX `contacts_email_idx` ON `contacts` (`email`);
CREATE INDEX `contacts_org_email_idx` ON `contacts` (`organization_id`, `email`);
CREATE INDEX `contacts_org_status_idx` ON `contacts` (`organization_id`, `status`);
CREATE INDEX `contacts_fullName_idx` ON `contacts` (`full_name`);
