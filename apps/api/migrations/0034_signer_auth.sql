ALTER TABLE `recipients` ADD `auth_method` text DEFAULT 'none' NOT NULL;
ALTER TABLE `recipients` ADD `access_code_hash` text;
