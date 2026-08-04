import { describe, expect, test } from "vitest";

import {
  ApiError,
  apiErrorResponse,
  apiResponse,
  handleApiError,
  validationErrorResponse,
} from "../errors";

describe("ApiError", () => {
  test("constructor sets status, code, message, and title correctly", () => {
    const error = new ApiError(401, "Invalid API key", "INVALID_API_KEY");
    expect(error.status).toBe(401);
    expect(error.code).toBe("INVALID_API_KEY");
    expect(error.message).toBe("Invalid API key");
    expect(error.title).toBe("Unauthorized");
    expect(error.name).toBe("ApiError");
    expect(error).toBeInstanceOf(Error);
  });

  test("default code is INTERNAL_ERROR", () => {
    const error = new ApiError(500, "Something went wrong");
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  test("unknown status code returns 'Error' as title", () => {
    const error = new ApiError(418, "I'm a teapot", "INTERNAL_ERROR");
    expect(error.title).toBe("Error");
  });

  test("maps all known status codes to correct titles", () => {
    const expectedTitles: Record<number, string> = {
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

    for (const [status, title] of Object.entries(expectedTitles)) {
      const error = new ApiError(Number(status), "test", "INTERNAL_ERROR");
      expect(error.title).toBe(title);
    }
  });

  test("toResponse returns correct RFC 7807 format", () => {
    const error = new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
    const response = error.toResponse();

    expect(response).toStrictEqual({
      type: "https://api.seal.app/errors/document-not-found",
      title: "Not Found",
      status: 404,
      detail: "Document not found",
      code: "DOCUMENT_NOT_FOUND",
    });
  });

  test("toResponse includes instance and errors when provided", () => {
    const fieldErrors = { email: ["Invalid format"] };
    const error = new ApiError(
      422,
      "Validation failed",
      "VALIDATION_ERROR",
      fieldErrors
    );
    const response = error.toResponse("/api/v1/documents");

    expect(response.instance).toBe("/api/v1/documents");
    expect(response.errors).toStrictEqual({ email: ["Invalid format"] });
  });

  test("toResponse omits instance and errors when not provided", () => {
    const error = new ApiError(400, "Bad request", "INVALID_REQUEST_BODY");
    const response = error.toResponse();

    expect(response).not.toHaveProperty("instance");
    expect(response).not.toHaveProperty("errors");
  });
});

describe("apiErrorResponse", () => {
  test("returns Response with correct status and Content-Type", () => {
    const res = apiErrorResponse(401, "Invalid key", "INVALID_API_KEY");
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });

  test("body matches expected JSON structure", async () => {
    const res = apiErrorResponse(
      403,
      "Insufficient scope",
      "INSUFFICIENT_SCOPE"
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("https://api.seal.app/errors/insufficient-scope");
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
    expect(body.detail).toBe("Insufficient scope");
    expect(body.code).toBe("INSUFFICIENT_SCOPE");
  });

  test("includes instance, errors, and custom headers when provided", async () => {
    const res = apiErrorResponse(422, "Invalid fields", "VALIDATION_ERROR", {
      instance: "/api/v1/documents",
      errors: { title: ["Required"] },
      headers: { "X-Request-Id": "abc-123" },
    });

    expect(res.headers.get("X-Request-Id")).toBe("abc-123");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.instance).toBe("/api/v1/documents");
    expect(body.errors).toStrictEqual({ title: ["Required"] });
  });
});

describe("apiResponse", () => {
  test("returns Response with JSON content type and correct body", async () => {
    const data = { documents: [{ id: "1" }] };
    const res = apiResponse(200, data);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");

    const body = await res.json();
    expect(body).toStrictEqual(data);
  });

  test("includes custom headers", () => {
    const res = apiResponse(
      201,
      { id: "doc_123" },
      { Location: "/api/v1/documents/doc_123" }
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe("/api/v1/documents/doc_123");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});

describe("handleApiError", () => {
  test("passes through ApiError correctly", async () => {
    const error = new ApiError(404, "Not found", "DOCUMENT_NOT_FOUND");
    const res = handleApiError(error, "/api/v1/documents/123");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("DOCUMENT_NOT_FOUND");
    expect(body.detail).toBe("Not found");
    expect(body.instance).toBe("/api/v1/documents/123");
  });

  test("preserves field errors from ApiError", async () => {
    const fieldErrors = { email: ["Invalid"] };
    const error = new ApiError(
      422,
      "Validation failed",
      "VALIDATION_ERROR",
      fieldErrors
    );
    const res = handleApiError(error);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.errors).toStrictEqual({ email: ["Invalid"] });
  });

  test("wraps unknown errors as 500 INTERNAL_ERROR", async () => {
    const res = handleApiError(new Error("unexpected"), "/api/v1/test");

    expect(res.status).toBe(500);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.detail).toBe("An unexpected error occurred");
    expect(body.instance).toBe("/api/v1/test");
  });

  test("handles non-Error thrown values", async () => {
    const res = handleApiError("string error");

    expect(res.status).toBe(500);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});

describe("validationErrorResponse", () => {
  test("returns 422 with field errors", async () => {
    const errors = {
      title: ["Title is required", "Title must be less than 200 characters"],
      email: ["Invalid email format"],
    };
    const res = validationErrorResponse(errors);

    expect(res.status).toBe(422);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.detail).toBe("The request body contains invalid fields");
    expect(body.title).toBe("Unprocessable Entity");
    expect(body.errors).toStrictEqual(errors);
  });
});
