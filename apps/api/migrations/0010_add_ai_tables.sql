CREATE TABLE IF NOT EXISTS "ai_field_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "public_id" text NOT NULL UNIQUE,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE cascade,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "fields" text NOT NULL,
  "model_used" text NOT NULL,
  "tokens_used" integer NOT NULL,
  "processing_time_ms" integer NOT NULL,
  "payment_extraction" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX IF NOT EXISTS "aiFieldSuggestions_documentId_idx" ON "ai_field_suggestions" ("document_id");
CREATE INDEX IF NOT EXISTS "aiFieldSuggestions_documentStatus_idx" ON "ai_field_suggestions" ("document_id", "status");
CREATE INDEX IF NOT EXISTS "aiFieldSuggestions_organizationId_idx" ON "ai_field_suggestions" ("organization_id");

CREATE TABLE IF NOT EXISTS "ai_document_annotations" (
  "id" text PRIMARY KEY NOT NULL,
  "public_id" text NOT NULL UNIQUE,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE cascade,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "annotations" text NOT NULL,
  "model_used" text NOT NULL,
  "tokens_used" integer NOT NULL,
  "processing_time_ms" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX IF NOT EXISTS "aiDocumentAnnotations_documentId_idx" ON "ai_document_annotations" ("document_id");
CREATE INDEX IF NOT EXISTS "aiDocumentAnnotations_documentStatus_idx" ON "ai_document_annotations" ("document_id", "status");
CREATE INDEX IF NOT EXISTS "aiDocumentAnnotations_organizationId_idx" ON "ai_document_annotations" ("organization_id");

CREATE TABLE IF NOT EXISTS "ai_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "public_id" text NOT NULL UNIQUE,
  "thread_id" text NOT NULL UNIQUE,
  "document_id" text REFERENCES "documents"("id") ON DELETE cascade,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "thread_type" text NOT NULL DEFAULT 'document',
  "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX IF NOT EXISTS "aiThreads_threadId_idx" ON "ai_threads" ("thread_id");
CREATE INDEX IF NOT EXISTS "aiThreads_documentId_idx" ON "ai_threads" ("document_id");
CREATE INDEX IF NOT EXISTS "aiThreads_organizationUser_idx" ON "ai_threads" ("organization_id", "user_id");
