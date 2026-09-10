import { describe, expect, it } from "vitest";

import {
  ApiError,
  apiErrorResponse,
  apiResponse,
  handleApiError,
  validationErrorResponse,
} from "./errors";

describe("ApiError", () => {
  it("creates error with correct properties", () => {
    const error = new ApiError(401, "Invalid API key", "INVALID_API_KEY");
    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid API key");
    expect(error.code).toBe("INVALID_API_KEY");
    expect(error.title).toBe("Unauthorized");
    expect(error.name).toBe("ApiError");
  });

  it("defaults code to INTERNAL_ERROR", () => {
    const error = new ApiError(500, "Something broke");
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("maps status codes to titles", () => {
    expect(new ApiError(400, "bad").title).toBe("Bad Request");
    expect(new ApiError(403, "nope").title).toBe("Forbidden");
    expect(new ApiError(404, "gone").title).toBe("Not Found");
    expect(new ApiError(409, "dup").title).toBe("Conflict");
    expect(new ApiError(422, "invalid").title).toBe("Unprocessable Entity");
    expect(new ApiError(429, "slow").title).toBe("Too Many Requests");
    expect(new ApiError(503, "down").title).toBe("Service Unavailable");
  });

  it('falls back to "Error" for unknown status codes', () => {
    expect(new ApiError(418, "teapot").title).toBe("Error");
  });

  it("stores field-level errors", () => {
    const errors = { email: ["Invalid format"] };
    const error = new ApiError(
      422,
      "Validation failed",
      "VALIDATION_ERROR",
      errors
    );
    expect(error.errors).toEqual(errors);
  });

  describe("toResponse", () => {
    it("produces RFC 7807 compliant response", () => {
      const error = new ApiError(
        404,
        "Document not found",
        "DOCUMENT_NOT_FOUND"
      );
      const response = error.toResponse();

      expect(response).toEqual({
        type: "https://api.seal.nyc/errors/document-not-found",
        title: "Not Found",
        status: 404,
        detail: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
      });
    });

    it("includes instance when provided", () => {
      const error = new ApiError(404, "Not found", "RESOURCE_NOT_FOUND");
      const response = error.toResponse("/api/v1/documents/abc123");
      expect(response.instance).toBe("/api/v1/documents/abc123");
    });

    it("includes field errors when present", () => {
      const errors = { title: ["Required"], email: ["Invalid"] };
      const error = new ApiError(422, "Invalid", "VALIDATION_ERROR", errors);
      expect(error.toResponse().errors).toEqual(errors);
    });

    it("converts error code to kebab-case URI", () => {
      const error = new ApiError(401, "Bad key", "INVALID_API_KEY");
      expect(error.toResponse().type).toBe(
        "https://api.seal.nyc/errors/invalid-api-key"
      );
    });
  });
});

describe("apiErrorResponse", () => {
  it("returns a Response with correct status and content type", async () => {
    const response = apiErrorResponse(401, "Unauthorized", "INVALID_API_KEY");
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe(
      "application/problem+json"
    );
  });

  it("body contains RFC 7807 fields", async () => {
    const response = apiErrorResponse(403, "No access", "INSUFFICIENT_SCOPE");
    const body = await response.json();
    expect(body.type).toContain("insufficient-scope");
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
    expect(body.detail).toBe("No access");
    expect(body.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("includes custom headers", async () => {
    const response = apiErrorResponse(429, "Slow down", "RATE_LIMIT_EXCEEDED", {
      headers: { "Retry-After": "60" },
    });
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});

describe("apiResponse", () => {
  it("returns a Response with correct status and content type", async () => {
    const response = apiResponse(200, { ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("body matches input data", async () => {
    const data = { documents: [{ id: "1" }], total: 1 };
    const response = apiResponse(200, data);
    const body = await response.json();
    expect(body).toEqual(data);
  });

  it("includes custom headers", async () => {
    const response = apiResponse(
      201,
      { id: "new" },
      { Location: "/api/v1/docs/new" }
    );
    expect(response.headers.get("Location")).toBe("/api/v1/docs/new");
  });
});

describe("handleApiError", () => {
  it("handles ApiError instances", async () => {
    const error = new ApiError(404, "Not found", "DOCUMENT_NOT_FOUND");
    const response = handleApiError(error, "/api/v1/documents/abc");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("DOCUMENT_NOT_FOUND");
    expect(body.instance).toBe("/api/v1/documents/abc");
  });

  it("wraps unknown errors as 500", async () => {
    const response = handleApiError(new Error("kaboom"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.detail).toBe("An unexpected error occurred");
  });

  it("wraps non-Error values as 500", async () => {
    const response = handleApiError("string error");
    expect(response.status).toBe(500);
  });
});

describe("validationErrorResponse", () => {
  it("returns 422 with field errors", async () => {
    const response = validationErrorResponse({
      email: ["Invalid format"],
      name: ["Required"],
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors.email).toEqual(["Invalid format"]);
    expect(body.errors.name).toEqual(["Required"]);
  });
});
