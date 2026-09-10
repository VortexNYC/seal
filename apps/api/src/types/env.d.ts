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
  SEAL_MCP_SIGNING_KEY?: string;
  SEAL_MCP_SIGNING_KEY_ID?: string;
  ALLOWED_ORIGINS: string;
  EMAIL_FROM: string;
  APP_URL: string;
  INTERNAL_API_KEY: string;
  TEST_MIGRATIONS?: D1Migration[];
}
