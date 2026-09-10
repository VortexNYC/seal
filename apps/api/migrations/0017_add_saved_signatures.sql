CREATE TABLE "saved_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"signature_image_url" text NOT NULL,
	"signature_type" text NOT NULL,
	"font_family" text,
	"is_default" integer DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	"updated_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade,
	FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
CREATE INDEX "savedSignatures_userId_idx" ON "saved_signatures" ("user_id");
CREATE INDEX "savedSignatures_organizationId_idx" ON "saved_signatures" ("organization_id");
