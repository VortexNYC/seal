CREATE TABLE "ai_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer,
	"completed_tools" text DEFAULT '[]' NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"error" text,
	"created_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	"updated_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("thread_id") ON DELETE cascade,
	FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade,
	FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
CREATE INDEX "aiProgress_threadId_idx" ON "ai_progress" ("thread_id");

CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"name" text,
	"created_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	"updated_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("thread_id") ON DELETE cascade,
	FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade,
	FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
CREATE INDEX "aiMessages_threadId_idx" ON "ai_messages" ("thread_id");
CREATE INDEX "aiMessages_createdAt_idx" ON "ai_messages" ("created_at");
