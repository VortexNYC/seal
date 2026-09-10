interface D1Migration {
  name: string;
  queries: string[];
}

declare namespace Cloudflare {
  interface Env extends CloudflareBindings {}
}

declare interface CloudflareBindings {
  D1: D1Database;
  DOCUMENTS_BUCKET: R2Bucket;
  EMAIL: SendEmail;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TOKEN_HASH_SECRET: string;
  ALLOWED_ORIGINS: string;
  EMAIL_FROM: string;
  TEST_MIGRATIONS?: D1Migration[];
}
