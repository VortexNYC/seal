ALTER TABLE "recipients" ADD COLUMN "esign_consent_at" integer;
--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "esign_consent_ip" text;
--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN "esign_consent_version" text;
