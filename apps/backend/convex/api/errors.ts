/**
 * @fileoverview Standardized error responses for the public API.
 * Follows RFC 7807 Problem Details for HTTP APIs format.
 *
 * @module api/errors
 * @see {@link https://www.rfc-editor.org/rfc/rfc7807} RFC 7807
 */

/**
 * Standard API error response format following RFC 7807.
 *
 * @interface ApiErrorResponse
 * @property {string} type - URI reference identifying the error type
 * @property {string} title - Short, human-readable summary
 * @property {number} status - HTTP status code
 * @property {string} detail - Human-readable explanation
 * @property {string} [instance] - URI reference for this specific occurrence
 * @property {string} [code] - Machine-readable error code
 * @property {Record<string, string[]>} [errors] - Field-level validation errors
 *
 * @example
 * ```json
 * {
 *   "type": "https://api.seal.app/errors/validation",
 *   "title": "Validation Error",
 *   "status": 422,
 *   "detail": "The request body contains invalid fields",
 *   "code": "VALIDATION_ERROR",
 *   "errors": {
 *     "title": ["Title is required", "Title must be less than 200 characters"]
 *   }
 * }
 * ```
 */
export interface ApiErrorResponse {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance?: string;
	code?: string;
	errors?: Record<string, string[]>;
}

/**
 * Machine-readable error codes for API errors.
 * Use these for programmatic error handling in client applications.
 *
 * @constant
 */
export const API_ERROR_CODES = {
	// Authentication errors (401)
	MISSING_AUTH_HEADER: "MISSING_AUTH_HEADER",
	INVALID_AUTH_FORMAT: "INVALID_AUTH_FORMAT",
	INVALID_API_KEY: "INVALID_API_KEY",
	INVALID_JWT: "INVALID_JWT",
	EXPIRED_API_KEY: "EXPIRED_API_KEY",
	REVOKED_API_KEY: "REVOKED_API_KEY",

	// Authorization errors (403)
	INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
	INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
	ORGANIZATION_ACCESS_DENIED: "ORGANIZATION_ACCESS_DENIED",
	RESOURCE_ACCESS_DENIED: "RESOURCE_ACCESS_DENIED",

	// Not found errors (404)
	RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
	USER_NOT_FOUND: "USER_NOT_FOUND",
	ORGANIZATION_NOT_FOUND: "ORGANIZATION_NOT_FOUND",
	DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",
	TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
	RECIPIENT_NOT_FOUND: "RECIPIENT_NOT_FOUND",
	WEBHOOK_NOT_FOUND: "WEBHOOK_NOT_FOUND",
	SIGNATURE_NOT_FOUND: "SIGNATURE_NOT_FOUND",

	// Validation errors (400/422)
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_REQUEST_BODY: "INVALID_REQUEST_BODY",
	MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
	INVALID_FIELD_VALUE: "INVALID_FIELD_VALUE",

	// Conflict errors (409)
	RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
	DOCUMENT_ALREADY_SENT: "DOCUMENT_ALREADY_SENT",
	DOCUMENT_ALREADY_COMPLETED: "DOCUMENT_ALREADY_COMPLETED",

	// Rate limiting (429)
	RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

	// Server errors (500)
	INTERNAL_ERROR: "INTERNAL_ERROR",
	SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ApiErrorCode =
	(typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * Base URL for error type URIs.
 * Points to documentation for each error type.
 */
const ERROR_TYPE_BASE = "https://api.seal.app/errors";

/**
 * Custom error class for API errors.
 * Provides structured error information for HTTP responses.
 *
 * @class ApiError
 * @extends Error
 *
 * @example
 * ```typescript
 * throw new ApiError(401, "Invalid API key", "INVALID_API_KEY");
 * ```
 */
export class ApiError extends Error {
	public readonly status: number;
	public readonly code: ApiErrorCode;
	public readonly title: string;
	public readonly errors?: Record<string, string[]>;

	constructor(
		status: number,
		detail: string,
		code: ApiErrorCode = "INTERNAL_ERROR",
		errors?: Record<string, string[]>,
	) {
		super(detail);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.title = this.getTitle(status);
		this.errors = errors;
	}

	/**
	 * Gets the standard title for an HTTP status code.
	 */
	private getTitle(status: number): string {
		const titles: Record<number, string> = {
			400: "Bad Request",
			401: "Unauthorized",
			403: "Forbidden",
			404: "Not Found",
			409: "Conflict",
			422: "Unprocessable Entity",
			429: "Too Many Requests",
			500: "Internal Server Error",
			503: "Service Unavailable",
		};
		return titles[status] ?? "Error";
	}

	/**
	 * Converts the error to an RFC 7807 compliant response object.
	 *
	 * @param instance - Optional URI reference for this specific error occurrence
	 * @returns ApiErrorResponse object
	 */
	toResponse(instance?: string): ApiErrorResponse {
		const response: ApiErrorResponse = {
			type: `${ERROR_TYPE_BASE}/${this.code.toLowerCase().replace(/_/g, "-")}`,
			title: this.title,
			status: this.status,
			detail: this.message,
			code: this.code,
		};

		if (instance) {
			response.instance = instance;
		}

		if (this.errors) {
			response.errors = this.errors;
		}

		return response;
	}
}

/**
 * Creates an HTTP Response with a JSON error body.
 *
 * @param status - HTTP status code
 * @param detail - Human-readable error message
 * @param code - Machine-readable error code
 * @param options - Additional options
 * @returns HTTP Response with JSON error body
 *
 * @example
 * ```typescript
 * return apiErrorResponse(401, "Invalid API key", "INVALID_API_KEY");
 * ```
 */
export function apiErrorResponse(
	status: number,
	detail: string,
	code: ApiErrorCode = "INTERNAL_ERROR",
	options?: {
		instance?: string;
		errors?: Record<string, string[]>;
		headers?: Record<string, string>;
	},
): Response {
	const error = new ApiError(status, detail, code, options?.errors);
	const body = error.toResponse(options?.instance);

	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/problem+json",
			...options?.headers,
		},
	});
}

/**
 * Creates a successful HTTP Response with JSON body.
 *
 * @param status - HTTP status code (2xx)
 * @param data - Response data
 * @param headers - Additional headers to include
 * @returns HTTP Response with JSON body
 *
 * @example
 * ```typescript
 * return apiResponse(200, { documents: [...] });
 * return apiResponse(201, { id: "doc_123" }, { "Location": "/api/v1/documents/doc_123" });
 * ```
 */
export function apiResponse<T>(
	status: number,
	data: T,
	headers?: Record<string, string>,
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	});
}

/**
 * Handles unknown errors and converts them to appropriate API responses.
 * Use this in catch blocks to ensure consistent error responses.
 *
 * @param error - The caught error
 * @param instance - Optional URI reference for this specific error occurrence
 * @returns HTTP Response with appropriate error
 *
 * @example
 * ```typescript
 * try {
 *   // ... API logic
 * } catch (error) {
 *   return handleApiError(error, "/api/v1/documents");
 * }
 * ```
 */
export function handleApiError(error: unknown, instance?: string): Response {
	if (error instanceof ApiError) {
		return apiErrorResponse(error.status, error.message, error.code, {
			instance,
			errors: error.errors,
		});
	}

	// Log unexpected errors for debugging
	console.error("[API Error]", error);

	return apiErrorResponse(
		500,
		"An unexpected error occurred",
		"INTERNAL_ERROR",
		{ instance },
	);
}

/**
 * Validation error helper for request body validation.
 *
 * @param errors - Field-level validation errors
 * @returns HTTP Response with 422 status and validation errors
 *
 * @example
 * ```typescript
 * return validationErrorResponse({
 *   title: ["Title is required"],
 *   email: ["Invalid email format"],
 * });
 * ```
 */
export function validationErrorResponse(
	errors: Record<string, string[]>,
): Response {
	return apiErrorResponse(
		422,
		"The request body contains invalid fields",
		"VALIDATION_ERROR",
		{ errors },
	);
}
