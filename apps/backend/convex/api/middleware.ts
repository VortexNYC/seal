/**
 * @fileoverview API middleware for HTTP actions.
 * Provides wrappers for API endpoints with authentication, rate limiting, and error handling.
 *
 * @module api/middleware
 */

import type { ActionCtx } from "../_generated/server";
import { httpAction } from "../_generated/server";
import { type ApiAuthContext, type ApiScope, requireScope, resolveAuthContext } from "./context";
import { ApiError, apiResponse, handleApiError } from "./errors";
import {
  buildRateLimitHeaders,
  checkApiRateLimit,
  type RateLimitConfig,
  throwRateLimitExceeded,
} from "./api_rate_limiter";
import { type ApiVersion, getApiVersion } from "./versioning";

/**
 * Request context passed to API handlers.
 * Includes authenticated context, parsed request data, and helpers.
 */
export interface ApiRequestContext {
  /** Convex action context */
  ctx: ActionCtx;

  /** Original HTTP request */
  request: Request;

  /** Authenticated API context (user, org, scopes) */
  auth: ApiAuthContext;

  /** API version from request headers */
  apiVersion: ApiVersion;

  /** Parsed URL for easy access to path and search params */
  url: URL;

  /** Request path segments after /api/v1/ */
  pathSegments: string[];

  /** Query parameters as a plain object */
  query: Record<string, string>;
}

/**
 * Handler function type for API endpoints.
 */
export type ApiHandler = (context: ApiRequestContext) => Promise<Response>;

/**
 * Options for creating an API endpoint.
 */
export interface ApiEndpointOptions {
  /**
   * Required scope for this endpoint.
   * If provided, the request will be rejected if the API key doesn't have this scope.
   */
  scope?: ApiScope;

  /**
   * Multiple acceptable scopes (OR logic).
   * Request is allowed if API key has any of these scopes.
   */
  scopes?: ApiScope[];

  /**
   * Whether to skip authentication.
   * Use with caution - only for public endpoints like health checks.
   * @default false
   */
  public?: boolean;

  /**
   * Rate limit configuration for this endpoint.
   * If not provided, uses default rate limits (60/min, 1000/hour).
   */
  rateLimit?: Partial<RateLimitConfig>;

  /**
   * Whether to skip rate limiting for this endpoint.
   * @default false
   */
  skipRateLimit?: boolean;
}

/**
 * Standard headers included in all API responses.
 */
const STANDARD_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

/**
 * Parses URL and extracts path segments and query params.
 */
function parseRequest(request: Request): {
  url: URL;
  pathSegments: string[];
  query: Record<string, string>;
} {
  const url = new URL(request.url);
  const path = url.pathname;

  // Remove /api/v1/ prefix and split into segments
  const apiPath = path.replace(/^\/api\/v\d+\/?/, "");
  const pathSegments = apiPath.split("/").filter(Boolean);

  // Convert search params to plain object
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return { url, pathSegments, query };
}

/**
 * Adds standard and rate limit headers to a response.
 */
function addResponseHeaders(response: Response, rateLimitHeaders?: Headers): Response {
  const headers = new Headers(response.headers);

  // Add standard security headers
  for (const [key, value] of Object.entries(STANDARD_HEADERS)) {
    headers.set(key, value);
  }

  // Add rate limit headers if provided
  if (rateLimitHeaders) {
    rateLimitHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Creates an authenticated API endpoint with built-in error handling and rate limiting.
 *
 * @param handler - The API handler function
 * @param options - Endpoint configuration options
 * @returns Convex httpAction
 *
 * @example Basic authenticated endpoint
 * ```typescript
 * export const listDocuments = apiHttpAction(
 *   async ({ auth, query }) => {
 *     const documents = await ctx.runQuery(internal.documents.list, {
 *       organizationId: auth.organizationId,
 *       limit: parseInt(query.limit) || 20,
 *     });
 *     return apiResponse(200, { data: documents });
 *   },
 *   { scope: API_SCOPES.DOCUMENTS_READ }
 * );
 * ```
 *
 * @example Endpoint with multiple acceptable scopes
 * ```typescript
 * export const getDocument = apiHttpAction(
 *   async ({ auth, pathSegments }) => {
 *     const documentId = pathSegments[0];
 *     // ...
 *   },
 *   { scopes: [API_SCOPES.DOCUMENTS_READ, API_SCOPES.DOCUMENTS_WRITE] }
 * );
 * ```
 */
export function apiHttpAction(handler: ApiHandler, options: ApiEndpointOptions = {}) {
  return httpAction(async (ctx, request) => {
    try {
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Version",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      // Parse request
      const { url, pathSegments, query } = parseRequest(request);

      // Get API version
      const apiVersion = getApiVersion(request);

      // Authenticate unless public endpoint
      let auth: ApiAuthContext | null = null;

      // Track rate limit result for headers
      let rateLimitHeaders: Headers | undefined;

      if (!options.public) {
        const authHeader = request.headers.get("Authorization");
        // Extract client IP for IP allowlist enforcement
        const forwarded = request.headers.get("x-forwarded-for");
        const clientIp = forwarded
          ? forwarded.split(",")[0]?.trim()
          : (request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-real-ip") ??
            undefined);
        auth = await resolveAuthContext(ctx, authHeader, clientIp);

        // Check required scopes
        if (options.scope) {
          requireScope(auth, options.scope);
        } else if (options.scopes && options.scopes.length > 0) {
          const hasRequiredScope = options.scopes.some((scope) => auth?.hasScope(scope));
          if (!hasRequiredScope) {
            throw new ApiError(
              403,
              `Missing required scope. Need one of: ${options.scopes.join(", ")}`,
              "INSUFFICIENT_SCOPE",
            );
          }
        }

        // Check rate limits (unless explicitly skipped)
        if (!options.skipRateLimit) {
          const rateLimitKey = auth.authType === "api_key" ? auth.apiKeyId : `jwt:${auth.userId}`;
          if (!rateLimitKey) {
            throw new ApiError(500, "Rate limit key unavailable", "INTERNAL_ERROR");
          }
          const rateLimitResult = await checkApiRateLimit(ctx, rateLimitKey, options.rateLimit);

          // Build headers regardless of result (for transparency)
          rateLimitHeaders = buildRateLimitHeaders(rateLimitResult);

          // Reject if rate limited
          if (!rateLimitResult.allowed) {
            throwRateLimitExceeded(rateLimitResult);
          }
        }
      }

      // Build request context
      const requestContext: ApiRequestContext = {
        ctx,
        request,
        auth: auth as ApiAuthContext,
        apiVersion,
        url,
        pathSegments,
        query,
      };

      // Execute handler
      const response = await handler(requestContext);

      // Add headers to response
      return addResponseHeaders(response, rateLimitHeaders);
    } catch (error) {
      return handleApiError(error, request.url);
    }
  });
}

/**
 * Creates a public API endpoint (no authentication required).
 * Use sparingly - most endpoints should require authentication.
 *
 * @param handler - The API handler function
 * @returns Convex httpAction
 *
 * @example Health check endpoint
 * ```typescript
 * export const healthCheck = publicApiHttpAction(async () => {
 *   return apiResponse(200, { status: "ok", timestamp: new Date().toISOString() });
 * });
 * ```
 */
export function publicApiHttpAction(
  handler: (context: Omit<ApiRequestContext, "auth">) => Promise<Response>,
) {
  return apiHttpAction(handler as ApiHandler, { public: true });
}

/**
 * Parses JSON body from request with error handling.
 *
 * @param request - The HTTP request
 * @returns Parsed JSON body
 * @throws {ApiError} 400 - If body is invalid JSON
 */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON in request body", "INVALID_REQUEST_BODY");
  }
}

/**
 * Parses and validates pagination parameters from query string.
 *
 * @param query - Query parameters object
 * @param defaults - Default values for pagination
 * @returns Parsed pagination parameters
 */
export function parsePagination(
  query: Record<string, string>,
  defaults: { limit: number; maxLimit: number } = { limit: 20, maxLimit: 100 },
): { limit: number; cursor?: string } {
  let limit = parseInt(query.limit ?? String(defaults.limit), 10);

  // Clamp limit to valid range
  if (Number.isNaN(limit) || limit < 1) {
    limit = defaults.limit;
  } else if (limit > defaults.maxLimit) {
    limit = defaults.maxLimit;
  }

  return {
    limit,
    cursor: query.cursor || undefined,
  };
}

/**
 * Creates a paginated response with cursor-based pagination.
 *
 * @param items - Array of items to return
 * @param hasMore - Whether there are more items
 * @param nextCursor - Cursor for the next page (if hasMore is true)
 * @returns Response with pagination metadata
 */
export function paginatedResponse<T>(items: T[], hasMore: boolean, nextCursor?: string): Response {
  return apiResponse(200, {
    data: items,
    has_more: hasMore,
    next_cursor: hasMore ? nextCursor : undefined,
  });
}

/**
 * Validates that required fields are present in the request body.
 *
 * @param body - The request body
 * @param requiredFields - Array of required field names
 * @throws {ApiError} 422 - If any required field is missing
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  requiredFields: string[],
): void {
  const errors: Record<string, string[]> = {};

  for (const field of requiredFields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      errors[field] = [`${field} is required`];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(422, "Missing required fields", "VALIDATION_ERROR", errors);
  }
}

export { API_SCOPES, type ApiScope } from "./context";
// Re-export commonly used utilities
export { apiErrorResponse, apiResponse } from "./errors";
