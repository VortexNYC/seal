import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { SealApiClient, SealApiError } from "./client";
import type { Config } from "./config";

const mockConfig: Config = {
	baseUrl: "https://api.test.com",
	apiKey: "test-api-key",
	requestTimeout: 5000,
	debug: false,
	maxFileSize: 50 * 1024 * 1024,
};

/**
 * Creates a mock fetch function that satisfies Bun's fetch type.
 */
function createMockFetch(
	handler: (
		url: string | URL | Request,
		options?: RequestInit,
	) => Promise<Response>,
): typeof globalThis.fetch {
	const mockFn = mock(handler);
	// Add the preconnect property required by Bun's fetch type
	Object.assign(mockFn, { preconnect: () => {} });
	return mockFn as unknown as typeof globalThis.fetch;
}

describe("SealApiClient", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe("constructor", () => {
		test("creates client with config", () => {
			const client = new SealApiClient(mockConfig);
			expect(client).toBeInstanceOf(SealApiClient);
		});
	});

	describe("get", () => {
		test("makes GET request with correct URL and headers", async () => {
			let capturedUrl: string | undefined;
			let capturedOptions: RequestInit | undefined;

			globalThis.fetch = createMockFetch(async (url, options) => {
				capturedUrl = url as string;
				capturedOptions = options as RequestInit;
				return new Response(JSON.stringify({ data: "test" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			});

			const client = new SealApiClient(mockConfig);
			const result = await client.get<{ data: string }>("/documents");

			expect(capturedUrl).toBe("https://api.test.com/documents");
			expect(capturedOptions?.method).toBe("GET");
			expect(capturedOptions?.headers).toMatchObject({
				Authorization: "Bearer test-api-key",
				"Content-Type": "application/json",
				Accept: "application/json",
			});
			expect(result).toEqual({ data: "test" });
		});

		test("appends query parameters to URL", async () => {
			let capturedUrl: string | undefined;

			globalThis.fetch = createMockFetch(async (url) => {
				capturedUrl = url as string;
				return new Response(JSON.stringify({}), { status: 200 });
			});

			const client = new SealApiClient(mockConfig);
			await client.get("/documents", { limit: 10, status: "draft" });

			expect(capturedUrl).toContain("limit=10");
			expect(capturedUrl).toContain("status=draft");
		});

		test("uses provided authToken over apiKey", async () => {
			let capturedOptions: RequestInit | undefined;

			globalThis.fetch = createMockFetch(async (_, options) => {
				capturedOptions = options as RequestInit;
				return new Response(JSON.stringify({}), { status: 200 });
			});

			const client = new SealApiClient(mockConfig);
			await client.get("/documents", undefined, "user-token-123");

			const headers = capturedOptions?.headers as Record<string, string>;
			expect(headers.Authorization).toBe("Bearer user-token-123");
		});

		test("throws error when no auth credentials available", async () => {
			const configWithoutKey: Config = {
				...mockConfig,
				apiKey: undefined,
			};

			const client = new SealApiClient(configWithoutKey);

			expect(client.get("/documents")).rejects.toThrow(
				"Missing API credentials",
			);
		});
	});

	describe("post", () => {
		test("makes POST request with body", async () => {
			let capturedOptions: RequestInit | undefined;

			globalThis.fetch = createMockFetch(async (_, options) => {
				capturedOptions = options as RequestInit;
				return new Response(JSON.stringify({ id: "123" }), { status: 200 });
			});

			const client = new SealApiClient(mockConfig);
			const result = await client.post<{ id: string }>(
				"/documents",
				{ title: "Test Doc" },
				undefined,
				"token",
			);

			expect(capturedOptions?.method).toBe("POST");
			expect(capturedOptions?.body).toBe(JSON.stringify({ title: "Test Doc" }));
			expect(result).toEqual({ id: "123" });
		});
	});

	describe("put", () => {
		test("makes PUT request", async () => {
			let capturedOptions: RequestInit | undefined;

			globalThis.fetch = createMockFetch(async (_, options) => {
				capturedOptions = options as RequestInit;
				return new Response(JSON.stringify({ success: true }), { status: 200 });
			});

			const client = new SealApiClient(mockConfig);
			await client.put(
				"/documents/update",
				{ title: "Updated" },
				{ id: "123" },
				"token",
			);

			expect(capturedOptions?.method).toBe("PUT");
		});
	});

	describe("delete", () => {
		test("makes DELETE request", async () => {
			let capturedOptions: RequestInit | undefined;

			globalThis.fetch = createMockFetch(async (_, options) => {
				capturedOptions = options as RequestInit;
				return new Response(JSON.stringify({ success: true }), { status: 200 });
			});

			const client = new SealApiClient(mockConfig);
			await client.delete("/documents/delete", { id: "123" }, "token");

			expect(capturedOptions?.method).toBe("DELETE");
		});
	});

	describe("error handling", () => {
		test("throws SealApiError for 4xx responses", async () => {
			globalThis.fetch = createMockFetch(async () => {
				return new Response(
					JSON.stringify({
						type: "NOT_FOUND",
						status: 404,
						title: "Document not found",
					}),
					{ status: 404 },
				);
			});

			const client = new SealApiClient(mockConfig);

			try {
				await client.get("/documents/get", { id: "nonexistent" });
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(SealApiError);
				const apiError = error as SealApiError;
				expect(apiError.message).toBe("Document not found");
				expect(apiError.code).toBe("NOT_FOUND");
				expect(apiError.status).toBe(404);
			}
		});

		test("handles RFC 7807 error format", async () => {
			globalThis.fetch = createMockFetch(async () => {
				return new Response(
					JSON.stringify({
						type: "VALIDATION_ERROR",
						status: 400,
						title: "Validation failed",
						details: { email: ["Invalid format"] },
					}),
					{ status: 400 },
				);
			});

			const client = new SealApiClient(mockConfig);

			try {
				await client.post(
					"/recipients",
					{ email: "invalid" },
					undefined,
					"token",
				);
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(SealApiError);
				const apiError = error as SealApiError;
				expect(apiError.message).toBe("Validation failed");
				expect(apiError.code).toBe("VALIDATION_ERROR");
				expect(apiError.status).toBe(400);
				expect(apiError.details).toEqual({ email: ["Invalid format"] });
			}
		});

		test("handles non-JSON error responses", async () => {
			globalThis.fetch = createMockFetch(async () => {
				return new Response("Internal Server Error", {
					status: 500,
					statusText: "Internal Server Error",
				});
			});

			const client = new SealApiClient(mockConfig);

			try {
				await client.get("/documents");
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(SealApiError);
				const apiError = error as SealApiError;
				expect(apiError.message).toBe("Internal Server Error");
				expect(apiError.code).toBe("API_ERROR");
				expect(apiError.status).toBe(500);
			}
		});

		test("handles 204 No Content responses", async () => {
			globalThis.fetch = createMockFetch(async () => {
				return new Response(null, { status: 204 });
			});

			const client = new SealApiClient(mockConfig);
			const result = await client.delete("/documents/delete", { id: "123" });

			expect(result).toEqual({});
		});
	});

	describe("uploadToStorage", () => {
		test("uploads file buffer to storage URL", async () => {
			let capturedUrl: string | undefined;
			let capturedOptions: RequestInit | undefined;

			globalThis.fetch = createMockFetch(async (url, options) => {
				capturedUrl = url as string;
				capturedOptions = options as RequestInit;
				return new Response(JSON.stringify({ storageId: "storage-123" }), {
					status: 200,
				});
			});

			const client = new SealApiClient(mockConfig);
			const buffer = Buffer.from("PDF content");
			const result = await client.uploadToStorage(
				"https://storage.example.com/upload",
				buffer,
				"application/pdf",
			);

			expect(capturedUrl).toBe("https://storage.example.com/upload");
			expect(capturedOptions?.method).toBe("POST");
			expect(
				(capturedOptions?.headers as Record<string, string>)["Content-Type"],
			).toBe("application/pdf");
			expect(result).toBe("storage-123");
		});

		test("throws error on upload failure", async () => {
			globalThis.fetch = createMockFetch(async () => {
				return new Response("Upload failed", { status: 500 });
			});

			const client = new SealApiClient(mockConfig);
			const buffer = Buffer.from("PDF content");

			expect(
				client.uploadToStorage(
					"https://storage.example.com/upload",
					buffer,
					"application/pdf",
				),
			).rejects.toThrow("Failed to upload file to storage");
		});

		test("throws timeout error when upload exceeds timeout", async () => {
			// Create a fetch that hangs until aborted
			globalThis.fetch = createMockFetch(async (_, options) => {
				const signal = (options as RequestInit)?.signal;
				return new Promise((_, reject) => {
					if (signal) {
						signal.addEventListener("abort", () => {
							const error = new Error("The operation was aborted");
							error.name = "AbortError";
							reject(error);
						});
					}
				});
			});

			const client = new SealApiClient(mockConfig);
			const buffer = Buffer.from("PDF content");

			// Use a very short timeout to trigger the timeout error
			await expect(
				client.uploadToStorage(
					"https://storage.example.com/upload",
					buffer,
					"application/pdf",
					10, // 10ms timeout
				),
			).rejects.toThrow("Upload timed out");
		});
	});
});
