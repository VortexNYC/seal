/**
 * @fileoverview API versioning support for backwards compatibility.
 * Implements header-based versioning with fallback to latest stable.
 *
 * @module api/versioning
 *
 * @example
 * ```
 * // Request with version header
 * curl -H "X-API-Version: 2025-01-01" https://api.seal.app/v1/documents
 *
 * // Without version header, defaults to latest stable
 * curl https://api.seal.app/v1/documents
 * ```
 */

/**
 * API version status.
 */
export type ApiVersionStatus = "current" | "deprecated" | "sunset";

/**
 * API version configuration.
 */
export interface ApiVersionConfig {
  /** Version status */
  status: ApiVersionStatus;

  /** Deprecation date (if deprecated) */
  deprecationDate: string | null;

  /** Sunset date when version will be removed */
  sunsetDate: string | null;

  /** Description of changes in this version */
  description?: string;
}

/**
 * Available API versions with their status.
 * Version format follows the date-based versioning scheme: YYYY-MM-DD
 *
 * @constant
 */
export const API_VERSIONS: Record<string, ApiVersionConfig> = {
  "2025-01-01": {
    status: "current",
    deprecationDate: null,
    sunsetDate: null,
    description: "Initial API release",
  },
} as const;

/**
 * The latest stable API version.
 * Used as default when no version is specified.
 */
export const LATEST_API_VERSION = "2025-01-01";

/**
 * Header name for API version.
 */
export const API_VERSION_HEADER = "X-API-Version";

/**
 * API version object returned to handlers.
 */
export interface ApiVersion {
  /** The version string (e.g., "2025-01-01") */
  version: string;

  /** Version configuration */
  config: ApiVersionConfig;

  /** Whether this was explicitly requested or defaulted */
  explicit: boolean;
}

/**
 * Parses and validates the API version from request headers.
 * Returns the default version if not specified or invalid.
 *
 * @param request - The HTTP request
 * @returns The resolved API version
 *
 * @example
 * ```typescript
 * const version = getApiVersion(request);
 * if (version.version === "2025-01-01") {
 *   // Handle v1 format
 * }
 * ```
 */
export function getApiVersion(request: Request): ApiVersion {
  const requestedVersion = request.headers.get(API_VERSION_HEADER);

  // Get the latest version config (we know this exists)
  const latestConfig = API_VERSIONS[LATEST_API_VERSION] as ApiVersionConfig;

  if (!requestedVersion) {
    return {
      version: LATEST_API_VERSION,
      config: latestConfig,
      explicit: false,
    };
  }

  // Validate version exists
  const config = API_VERSIONS[requestedVersion];
  if (!config) {
    // Invalid version, fall back to latest
    console.warn(
      `[API] Invalid API version requested: ${requestedVersion}, using ${LATEST_API_VERSION}`
    );
    return {
      version: LATEST_API_VERSION,
      config: latestConfig,
      explicit: false,
    };
  }

  return {
    version: requestedVersion,
    config,
    explicit: true,
  };
}

/**
 * Checks if an API version is deprecated.
 *
 * @param version - The API version to check
 * @returns Whether the version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const config = API_VERSIONS[version];
  return config?.status === "deprecated" || config?.status === "sunset";
}

/**
 * Checks if an API version is sunset (no longer supported).
 *
 * @param version - The API version to check
 * @returns Whether the version is sunset
 */
export function isVersionSunset(version: string): boolean {
  const config = API_VERSIONS[version];
  return config?.status === "sunset";
}

/**
 * Generates deprecation warning headers for deprecated versions.
 *
 * @param version - The API version
 * @returns Headers to include in response, or null if not deprecated
 */
export function getDeprecationHeaders(
  version: string
): Record<string, string> | null {
  const config = API_VERSIONS[version];

  if (!config || config.status === "current") {
    return null;
  }

  const headers: Record<string, string> = {
    Deprecation: config.deprecationDate
      ? `date="${config.deprecationDate}"`
      : "true",
  };

  if (config.sunsetDate) {
    headers.Sunset = config.sunsetDate;
  }

  headers.Link = `</api/v1>; rel="successor-version"`;

  return headers;
}

/**
 * Adds version information headers to a response.
 *
 * @param response - The response to add headers to
 * @param version - The API version used
 * @returns Response with version headers
 */
export function addVersionHeaders(
  response: Response,
  version: ApiVersion
): Response {
  const headers = new Headers(response.headers);

  // Always include the version used
  headers.set(API_VERSION_HEADER, version.version);

  // Add deprecation headers if applicable
  const deprecationHeaders = getDeprecationHeaders(version.version);
  if (deprecationHeaders) {
    for (const [key, value] of Object.entries(deprecationHeaders)) {
      headers.set(key, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Returns information about all available API versions.
 * Useful for documentation and version negotiation.
 *
 * @returns Array of version information
 */
export function listApiVersions(): Array<{
  version: string;
  status: ApiVersionStatus;
  current: boolean;
  deprecationDate: string | null;
  sunsetDate: string | null;
}> {
  return Object.entries(API_VERSIONS).map(([version, config]) => ({
    version,
    status: config.status,
    current: version === LATEST_API_VERSION,
    deprecationDate: config.deprecationDate,
    sunsetDate: config.sunsetDate,
  }));
}
