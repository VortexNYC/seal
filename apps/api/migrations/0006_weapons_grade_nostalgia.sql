CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL UNIQUE,
  `user_id` text NOT NULL,
  `organization_id` text NOT NULL,
  `type` text NOT NULL,
  `data` text NOT NULL,
  `read` integer DEFAULT false NOT NULL,
  `read_at` integer,
  `email_status` text,
  `email_sent_at` integer,
  `email_attempts` integer,
  `last_email_error` text,
  `email_message_id` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX `notifications_organizationId_idx` ON `notifications` (`organization_id`);
CREATE INDEX `notifications_userId_idx` ON `notifications` (`user_id`);
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`, `read`);
CREATE INDEX `notifications_user_createdAt_idx` ON `notifications` (`user_id`, `created_at`);
