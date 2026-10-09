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
  /** Optional — self-host can omit Email Routing until a sender is verified. */
  EMAIL?: SendEmail;
  SEAL_CONVERT_WORKER?: Fetcher;
  /** Optional — PDF upload/sign works without anydoc enrichment. */
  ANYDOC?: Fetcher;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TOKEN_HASH_SECRET: string;
  MCP_SIGNING_KEY?: string;
  MCP_SIGNING_KEY_ID?: string;
  /**
   * Optional. Base64 PKCS#12 for platform PAdES-B (SEA-49 L1b).
   * Pair with SEAL_SEALING_P12_PASSPHRASE. Absent → flatten only (self-host).
   */
  SEAL_SEALING_P12?: string;
  /** Passphrase for SEAL_SEALING_P12. */
  SEAL_SEALING_P12_PASSPHRASE?: string;
  /** Job runner DO — absent in self-hosts that skip background work. */
  JOB_RUNNER?: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  EMAIL_FROM: string;
  APP_URL: string;
  /**
   * Optional. Seal's Vortex merchant key. When a document stores
   * `vortex_order_form_id`, send registers the signature request and
   * completion signs and executes the order. Absent → signing is unchanged.
   */
  VORTEX_API_KEY?: string;
  /** Defaults to https://api.vortex.nyc */
  VORTEX_API_BASE_URL?: string;
  INTERNAL_API_KEY: string;
  TEST_MIGRATIONS?: D1Migration[];
}
