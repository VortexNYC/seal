ALTER TABLE `documents` ADD `parent_document_id` text REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE `documents` ADD `original_storage_key` text;
ALTER TABLE `documents` ADD `original_content_type` text;
CREATE INDEX `documents_parent_document_id_idx` ON `documents` (`parent_document_id`);
