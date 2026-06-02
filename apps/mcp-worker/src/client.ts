import type { ApiError } from "@seal/backend/convex/validations/api";

// Worker edition: uploadToStorageStream uses Web Standards ReadableStream rather
// than node:stream Readable. ReadableStream is part of the fetch body init type
// and works directly with fetch() in Workers.

import type { Config } from "./config";
import { logger } from "./utils/logger";

type RequestQueryValue = string | number | boolean | undefined;

interface RequestOptions {
  query?: Record<string, RequestQueryValue>;
  body?: Record<string, unknown>;
  authToken?: string;
  /** Override the default timeout for this request (in ms) */
  timeout?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringValue(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

/**
 * Custom error class for API errors.
 * Provides structured error information from the Seal API.
 */
export class SealApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(error: ApiError) {
    super(error.title);
    this.name = "SealApiError";
    this.code = error.type;
    this.status = error.status;
    this.details = error.details;
  }
}

/**
 * Error thrown when a requested resource is not found.
 */
class NotFoundError extends SealApiError {
  constructor(message: string) {
    super({
      type: "NOT_FOUND",
      status: 404,
      title: message,
    });
  }
}

/**
 * Error thrown when request validation fails.
 */
class ValidationError extends SealApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      type: "VALIDATION_ERROR",
      status: 400,
      title: message,
      details,
    });
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
class RateLimitError extends SealApiError {
  constructor(message = "Rate limit exceeded") {
    super({
      type: "RATE_LIMIT_ERROR",
      status: 429,
      title: message,
    });
  }
}

/**
 * HTTP client for the Seal API.
 * Handles authentication, request/response processing, and error handling.
 */
export class SealApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly debug: boolean;

  constructor(config: Config) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.requestTimeout;
    this.debug = config.debug;
  }

  private resolveAuthToken(authToken?: string): string {
    if (authToken && authToken.trim().length > 0) {
      return authToken;
    }

    if (this.apiKey) {
      return this.apiKey;
    }

    throw new SealApiError({
      type: "AUTH_ERROR",
      status: 401,
      title: "Missing API credentials",
    });
  }

  private buildUrl(path: string, query?: Record<string, RequestQueryValue>): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    if (!query) {
      return url;
    }

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url;
  }

  private createJsonRequestInit(
    method: string,
    authToken: string,
    body: Record<string, unknown> | undefined,
    signal: AbortSignal,
  ): RequestInit {
    return {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    };
  }

  private createFallbackApiError(response: Response): ApiError {
    return {
      type: "API_ERROR",
      status: response.status,
      title: response.statusText || "Request failed",
    };
  }

  private parseApiErrorBody(json: Record<string, unknown>, response: Response): ApiError {
    return {
      type: getStringValue(json, ["type", "code"]) ?? "UNKNOWN_ERROR",
      status: typeof json.status === "number" ? json.status : response.status,
      title: getStringValue(json, ["title", "message", "detail"]) ?? response.statusText,
      details: isRecord(json.details)
        ? json.details
        : isRecord(json.errors)
          ? json.errors
          : undefined,
    };
  }

  private async getApiError(response: Response): Promise<ApiError> {
    try {
      const json = (await response.json()) as Record<string, unknown>;
      return this.parseApiErrorBody(json, response);
    } catch {
      return this.createFallbackApiError(response);
    }
  }

  private throwApiError(error: ApiError): never {
    switch (error.status) {
      case 400:
        throw new ValidationError(error.title, error.details);
      case 404:
        throw new NotFoundError(error.title);
      case 429:
        throw new RateLimitError(error.title);
      default:
        throw new SealApiError(error);
    }
  }

  private normalizeRequestError(error: unknown): never {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SealApiError({
        type: "TIMEOUT",
        status: 408,
        title: "Request timed out",
      });
    }

    if (error instanceof SealApiError) {
      throw error;
    }

    throw new SealApiError({
      type: "NETWORK_ERROR",
      status: 0,
      title: error instanceof Error ? error.message : "Unknown error",
    });
  }

  /**
   * Options for API requests.
   */
  private async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.query);

    if (this.debug) {
      logger.debug(`${method} ${url.toString()}`);
    }

    const requestTimeout = options?.timeout ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const response = await fetch(
        url.toString(),
        this.createJsonRequestInit(
          method,
          this.resolveAuthToken(options?.authToken),
          options?.body,
          controller.signal,
        ),
      );

      if (!response.ok) {
        this.throwApiError(await this.getApiError(response));
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      return this.normalizeRequestError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Makes a GET request.
   * @param path - API endpoint path
   * @param query - Optional query parameters
   * @param authToken - Optional auth token (overrides default)
   * @param timeout - Optional timeout in ms (overrides default)
   */
  async get<T>(
    path: string,
    query?: Record<string, RequestQueryValue>,
    authToken?: string,
    timeout?: number,
  ): Promise<T> {
    return this.request<T>("GET", path, { query, authToken, timeout });
  }

  /**
   * Makes a POST request.
   * @param path - API endpoint path
   * @param body - Optional request body
   * @param query - Optional query parameters
   * @param authToken - Optional auth token (overrides default)
   * @param timeout - Optional timeout in ms (overrides default)
   */
  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, RequestQueryValue>,
    authToken?: string,
    timeout?: number,
  ): Promise<T> {
    return this.request<T>("POST", path, { body, query, authToken, timeout });
  }

  /**
   * Makes a PUT request.
   * @param path - API endpoint path
   * @param body - Optional request body
   * @param query - Optional query parameters
   * @param authToken - Optional auth token (overrides default)
   * @param timeout - Optional timeout in ms (overrides default)
   */
  async put<T>(
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, RequestQueryValue>,
    authToken?: string,
    timeout?: number,
  ): Promise<T> {
    return this.request<T>("PUT", path, { body, query, authToken, timeout });
  }

  /**
   * Makes a PATCH request.
   * @param path - API endpoint path
   * @param body - Optional request body
   * @param query - Optional query parameters
   * @param authToken - Optional auth token (overrides default)
   * @param timeout - Optional timeout in ms (overrides default)
   */
  async patch<T>(
    path: string,
    body?: Record<string, unknown>,
    authToken?: string,
    timeout?: number,
  ): Promise<T> {
    return this.request<T>("PATCH", path, { body, authToken, timeout });
  }

  /**
   * Makes a DELETE request.
   * @param path - API endpoint path
   * @param query - Optional query parameters
   * @param authToken - Optional auth token (overrides default)
   * @param timeout - Optional timeout in ms (overrides default)
   */
  async delete<T>(
    path: string,
    query?: Record<string, RequestQueryValue>,
    authToken?: string,
    timeout?: number,
  ): Promise<T> {
    return this.request<T>("DELETE", path, { query, authToken, timeout });
  }

  /**
   * Uploads a file buffer to a Convex storage URL.
   * Returns the storageId from the response.
   *
   * @param uploadUrl - The temporary upload URL from Convex
   * @param fileBuffer - The file content as a Buffer
   * @param contentType - The MIME type of the file
   * @param timeout - Optional timeout in ms (defaults to 60000ms for uploads)
   * @returns The storageId for the uploaded file
   */
  async uploadToStorage(
    uploadUrl: string,
    fileBuffer: Buffer,
    contentType: string,
    timeout?: number,
  ): Promise<string> {
    if (this.debug) {
      logger.debug(`Uploading file to storage (${fileBuffer.length} bytes)`);
    }

    // Use longer timeout for uploads (default 60s)
    const uploadTimeout = timeout ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), uploadTimeout);

    try {
      // Workers + @types/node type-collision: BlobPart's ArrayBufferView is
      // parameterised over plain ArrayBuffer, while Node's Buffer.buffer is
      // typed ArrayBufferLike (includes SharedArrayBuffer). At runtime Buffer
      // is a Uint8Array and Workers' fetch accepts it directly as BodyInit.
      // Narrow cast to bypass the structural mismatch.
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: fileBuffer as unknown as BodyInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new SealApiError({
          type: "UPLOAD_FAILED",
          status: response.status,
          title: "Failed to upload file to storage",
        });
      }

      const result = (await response.json()) as { storageId: string };
      return result.storageId;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new SealApiError({
          type: "UPLOAD_TIMEOUT",
          status: 408,
          title: "Upload timed out",
        });
      }

      if (error instanceof SealApiError) {
        throw error;
      }

      throw new SealApiError({
        type: "UPLOAD_FAILED",
        status: 0,
        title: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  /**
   * Uploads a file stream to a Convex storage URL.
   * Returns the storageId from the response.
   *
   * @param uploadUrl - The temporary upload URL from Convex
   * @param fileStream - The file content as a Readable stream
   * @param contentType - The MIME type of the file
   * @param contentLength - Optional content length for progress tracking
   * @param timeout - Optional timeout in ms (defaults to 60000ms for uploads)
   * @returns The storageId for the uploaded file
   */
  async uploadToStorageStream(
    uploadUrl: string,
    fileStream: ReadableStream<Uint8Array>,
    contentType: string,
    contentLength?: number,
    timeout?: number,
  ): Promise<string> {
    if (this.debug) {
      logger.debug(`Streaming file upload to storage (${contentLength ?? "unknown"} bytes)`);
    }

    // Use longer timeout for uploads (default 60s)
    const uploadTimeout = timeout ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), uploadTimeout);

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          ...(contentLength ? { "Content-Length": contentLength.toString() } : {}),
        },
        body: fileStream,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new SealApiError({
          type: "UPLOAD_FAILED",
          status: response.status,
          title: "Failed to upload file to storage",
        });
      }

      const result = (await response.json()) as { storageId: string };
      return result.storageId;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new SealApiError({
          type: "UPLOAD_TIMEOUT",
          status: 408,
          title: "Upload timed out",
        });
      }

      if (error instanceof SealApiError) {
        throw error;
      }

      throw new SealApiError({
        type: "UPLOAD_FAILED",
        status: 0,
        title: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }
}
