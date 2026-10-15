ALTER TABLE `api_tokens` ADD COLUMN `allowed_ip_ranges` text NOT NULL DEFAULT '[]';
