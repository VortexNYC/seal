CREATE TABLE `signature_fields` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL UNIQUE,
  `document_id` text NOT NULL,
  `recipient_id` text,
  `template_field_id` text,
  `field_type` text NOT NULL,
  `label` text NOT NULL,
  `is_required` integer DEFAULT false NOT NULL,
  `is_main_signature` integer DEFAULT false NOT NULL,
  `x` real NOT NULL,
  `y` real NOT NULL,
  `width` real NOT NULL,
  `height` real NOT NULL,
  `page` integer NOT NULL,
  `properties` text,
  `validation_rules` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `signature_fields_public_id_unique` ON `signature_fields` (`public_id`);
CREATE INDEX `signature_fields_document_id_idx` ON `signature_fields` (`document_id`);
CREATE INDEX `signature_fields_recipient_id_idx` ON `signature_fields` (`recipient_id`);
CREATE INDEX `signature_fields_document_page_idx` ON `signature_fields` (`document_id`, `page`);
CREATE INDEX `signature_fields_document_recipient_idx` ON `signature_fields` (`document_id`, `recipient_id`);

CREATE TABLE `payment_field_configs` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL UNIQUE,
  `field_id` text NOT NULL,
  `document_id` text NOT NULL,
  `organization_id` text NOT NULL,
  `payment_type` text NOT NULL,
  `items` text NOT NULL,
  `currency` text NOT NULL,
  `due_date_terms` text NOT NULL,
  `custom_due_days` integer,
  `custom_due_date` text,
  `late_fees` text,
  `recurring_config` text,
  `installments_config` text,
  `deposit_balance_config` text,
  `allowed_payment_methods` text NOT NULL,
  `fee_handling` text NOT NULL,
  `tax_enabled` integer DEFAULT false NOT NULL,
  `tax_behavior` text,
  `total_amount_cents` integer NOT NULL,
  `provider_invoice_id` text,
  `provider_subscription_id` text,
  `provider_payment_intent_id` text,
  `hosted_invoice_url` text,
  `vortex_payable_id` text,
  `vortex_deposit_balance_payable_id` text,
  `vortex_installment_payable_id` text,
  `vortex_recurring_payable_id` text,
  `vortex_payment_request_id` text,
  `payment_status` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`field_id`) REFERENCES `signature_fields`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `payment_field_configs_field_id_idx` ON `payment_field_configs` (`field_id`);
CREATE INDEX `payment_field_configs_document_id_idx` ON `payment_field_configs` (`document_id`);
CREATE INDEX `payment_field_configs_organization_id_idx` ON `payment_field_configs` (`organization_id`);
