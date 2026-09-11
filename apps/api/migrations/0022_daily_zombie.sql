CREATE TABLE `document_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text DEFAULT 'vortex_billing',
	`provider_account_id` text,
	`provider_invoice_id` text,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`vortex_payable_id` text,
	`vortex_payment_request_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`customer_email` text NOT NULL,
	`customer_name` text,
	`amount_due` integer NOT NULL,
	`currency` text NOT NULL,
	`hosted_invoice_url` text,
	`invoice_pdf` text,
	`finalized_at` integer,
	`paid_at` integer,
	`voided_at` integer,
	`deleted_at` integer,
	`dunning_status` text DEFAULT 'none' NOT NULL,
	`dunning_step` integer DEFAULT 0 NOT NULL,
	`dunning_started_at` integer,
	`last_dunning_email_at` integer,
	`next_dunning_at` integer,
	`dunning_completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documentInvoices_documentId_idx` ON `document_invoices` (`document_id`);--> statement-breakpoint
CREATE INDEX `documentInvoices_providerInvoiceId_idx` ON `document_invoices` (`provider_invoice_id`);--> statement-breakpoint
CREATE INDEX `documentInvoices_vortexPayableId_idx` ON `document_invoices` (`vortex_payable_id`);--> statement-breakpoint
CREATE INDEX `documentInvoices_organizationId_idx` ON `document_invoices` (`organization_id`);--> statement-breakpoint
CREATE INDEX `documentInvoices_providerSubscriptionId_idx` ON `document_invoices` (`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `documentInvoices_dunningStatus_nextDunningAt_idx` ON `document_invoices` (`dunning_status`,`next_dunning_at`);