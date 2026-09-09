CREATE TABLE `folders` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL UNIQUE,
  `organization_id` text NOT NULL,
  `name` text NOT NULL,
  `parent_id` text,
  `type` text DEFAULT 'document' NOT NULL,
  `visibility` text DEFAULT 'everyone' NOT NULL,
  `pinned` integer DEFAULT false,
  `created_by` text NOT NULL,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX `folders_organizationId_idx` ON `folders` (`organization_id`);
CREATE INDEX `folders_parentId_idx` ON `folders` (`parent_id`);
CREATE INDEX `folders_org_type_idx` ON `folders` (`organization_id`, `type`);
CREATE INDEX `folders_org_createdBy_idx` ON `folders` (`organization_id`, `created_by`);

CREATE TABLE `document_access` (
  `id` text PRIMARY KEY NOT NULL,
  `document_id` text NOT NULL,
  `user_id` text NOT NULL,
  `permission_level` text DEFAULT 'view' NOT NULL,
  `granted_by` text NOT NULL,
  `granted_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_by` text,
  `updated_at` integer,
  `revoked_at` integer,
  `revoked_by` text
);

CREATE INDEX `documentAccess_documentId_idx` ON `document_access` (`document_id`);
CREATE INDEX `documentAccess_userId_idx` ON `document_access` (`user_id`);
CREATE INDEX `documentAccess_document_user_idx` ON `document_access` (`document_id`, `user_id`);

ALTER TABLE `documents` ADD COLUMN `owner_id` text DEFAULT '' NOT NULL;
ALTER TABLE `documents` ADD COLUMN `folder_id` text;
ALTER TABLE `documents` ADD COLUMN `description` text;
ALTER TABLE `documents` ADD COLUMN `document_status` text DEFAULT 'active' NOT NULL;
ALTER TABLE `documents` ADD COLUMN `sharing_mode` text DEFAULT 'private' NOT NULL;
ALTER TABLE `documents` ADD COLUMN `ai_processing_status` text;
ALTER TABLE `documents` ADD COLUMN `page_count` integer;
ALTER TABLE `documents` ADD COLUMN `thumbnail_data_url` text;

CREATE INDEX `documents_ownerId_idx` ON `documents` (`owner_id`);
CREATE INDEX `documents_folderId_idx` ON `documents` (`folder_id`);
CREATE INDEX `documents_documentStatus_idx` ON `documents` (`document_status`);
