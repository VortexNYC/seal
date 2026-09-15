ALTER TABLE `documents` ADD `parsed_text` text;
ALTER TABLE `documents` ADD `parsed_title` text;
ALTER TABLE `documents` ADD `parsed_format` text;
ALTER TABLE `documents` ADD `pdf_type` text;
ALTER TABLE `documents` ADD `ocr_required` integer NOT NULL DEFAULT 0;
ALTER TABLE `documents` ADD `pages_needing_ocr` text;
ALTER TABLE `documents` ADD `field_candidates` text;
