/**
 * @fileoverview Public API module exports.
 * This module provides the foundation for Seal's public REST API.
 *
 * @module api
 *
 * @example Setting up an API endpoint
 * ```typescript
 * import { apiHttpAction, API_SCOPES, apiResponse } from "../api";
 *
 * export const listDocuments = apiHttpAction(
 *   async ({ auth, query, ctx }) => {
 *     const documents = await ctx.runQuery(internal.documents.list, {
 *       organizationId: auth.organizationId,
 *     });
 *     return apiResponse(200, { data: documents });
 *   },
 *   { scope: API_SCOPES.DOCUMENTS_READ }
 * );
 * ```
 */

// Context and authentication
export {
  API_SCOPES,
  type ApiAuthContext,
  type ApiScope,
  canUserUseScope,
  requireAnyScope,
  requireScope,
  resolveApiAuth,
  resolveAuthContext,
  SCOPE_PERMISSION_MAP,
} from "./context";

// Error handling
export {
  API_ERROR_CODES,
  ApiError,
  type ApiErrorCode,
  type ApiErrorResponse,
  apiErrorResponse,
  apiResponse,
  handleApiError,
  validationErrorResponse,
} from "./errors";

// Middleware and request handling
export {
  type ApiEndpointOptions,
  type ApiHandler,
  type ApiRequestContext,
  apiHttpAction,
  paginatedResponse,
  parseJsonBody,
  parsePagination,
  publicApiHttpAction,
  validateRequiredFields,
} from "./middleware";

// API versioning
export {
  API_VERSION_HEADER,
  API_VERSIONS,
  type ApiVersion,
  type ApiVersionConfig,
  type ApiVersionStatus,
  addVersionHeaders,
  getApiVersion,
  getDeprecationHeaders,
  isVersionDeprecated,
  isVersionSunset,
  LATEST_API_VERSION,
  listApiVersions,
} from "./versioning";
