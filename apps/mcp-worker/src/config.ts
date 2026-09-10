import { z } from "zod";

/**
 * Configuration schema for the Seal MCP server.
 * Validates environment variables with sensible defaults.
 */
const configSchema = z.object({
  /** Optional API key for server-to-server auth (fallback when no user token) */
  apiKey: z.string().min(1).optional(),
  /** Base URL for the Seal API */
  baseUrl: z.string().url().default("https://api.seal.nyc/api/v1"),
  /**
   * Origin of the OAuth authorization server that issues MCP access tokens.
   * Defaults to this worker's origin.
   */
  authServerOrigin: z.string().url().optional(),
  /** Request timeout in milliseconds */
  requestTimeout: z.coerce.number().default(30000),
  /** Enable debug logging */
  debug: z.coerce.boolean().default(false),
  /** Maximum file upload size in bytes (default: 50MB) */
  maxFileSize: z.coerce.number().default(50 * 1024 * 1024),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Loads and validates configuration from environment variables.
 * @throws {Error} If required configuration is missing or invalid
 */
function loadConfig(): Config {
  const result = configSchema.safeParse({
    apiKey: process.env.SEAL_API_KEY,
    baseUrl: process.env.SEAL_API_BASE_URL,
    authServerOrigin: process.env.SEAL_AUTH_SERVER_ORIGIN,
    requestTimeout: process.env.SEAL_REQUEST_TIMEOUT,
    debug: process.env.SEAL_DEBUG,
    maxFileSize: process.env.SEAL_MAX_FILE_SIZE,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid configuration: ${errors}`);
  }

  return result.data;
}

/**
 * Singleton configuration instance.
 * Lazily loaded on first access.
 */
let cachedConfig: Config | null = null;

/**
 * Gets the configuration, loading it if necessary.
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
