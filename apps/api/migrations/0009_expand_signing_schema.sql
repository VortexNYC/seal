-- Add signing-specific columns needed for field-level signing, public tokens, and document metadata

-- Document signing metadata
ALTER TABLE "documents" ADD COLUMN "redirect_url" text;
ALTER TABLE "documents" ADD COLUMN "allow_dictate_next_signer" integer NOT NULL DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN "signing_mode" text NOT NULL DEFAULT 'parallel';

-- Recipient signing state
ALTER TABLE "recipients" ADD COLUMN "signing_token" text;
ALTER TABLE "recipients" ADD COLUMN "token_expires_at" integer;
ALTER TABLE "recipients" ADD COLUMN "approved_at" integer;
ALTER TABLE "recipients" ADD COLUMN "declined_at" integer;
ALTER TABLE "recipients" ADD COLUMN "signature_data" text;
ALTER TABLE "recipients" ADD COLUMN "signature_type" text;
ALTER TABLE "recipients" ADD COLUMN "authentication_data" text;

CREATE UNIQUE INDEX IF NOT EXISTS "recipients_signingToken_unique_idx" ON "recipients" ("signing_token");

-- Signature field linkage and audit data
ALTER TABLE "signatures" ADD COLUMN "field_id" text REFERENCES "signature_fields"("id") ON DELETE SET NULL;
ALTER TABLE "signatures" ADD COLUMN "user_agent" text;
ALTER TABLE "signatures" ADD COLUMN "signature_image_url" text;
ALTER TABLE "signatures" ADD COLUMN "signature_method" text;
ALTER TABLE "signatures" ADD COLUMN "signature_hash" text;
ALTER TABLE "signatures" ADD COLUMN "signature_image_hash" text;
ALTER TABLE "signatures" ADD COLUMN "document_hash_at_signing" text;
ALTER TABLE "signatures" ADD COLUMN "authentication_data" text;
ALTER TABLE "signatures" ADD COLUMN "updated_at" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "signatures_fieldId_idx" ON "signatures" ("field_id");
CREATE INDEX IF NOT EXISTS "signatures_documentRecipient_idx" ON "signatures" ("document_id", "recipient_id");
