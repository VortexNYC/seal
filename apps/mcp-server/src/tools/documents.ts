// @ts-nocheck - MCP SDK has known issues with deep Zod type inference
// Runtime validation still works correctly via Zod
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SealApiClient } from "../client.js";
import type { ApiDocument, PaginatedResponse } from "../types.js";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

// Define schemas separately to avoid TypeScript "Type instantiation is excessively deep" errors
// Using explicit type annotations helps TypeScript avoid deep recursion
const ListDocumentsSchema: Record<string, z.ZodTypeAny> = {
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of documents to return (1-100, default 20)"),
	cursor: z
		.string()
		.optional()
		.describe("Pagination cursor from previous response"),
	status: z
		.enum([
			"draft",
			"sent",
			"in_progress",
			"completed",
			"cancelled",
			"declined",
		])
		.optional()
		.describe("Filter by workflow status"),
};

const GetDocumentSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The document ID"),
	include_recipients: z
		.boolean()
		.optional()
		.describe("Include recipient details in response (default false)"),
};

const CreateDocumentSchema: Record<string, z.ZodTypeAny> = {
	title: z.string().describe("Document title"),
	description: z.string().optional().describe("Document description"),
	storage_id: z
		.string()
		.describe("Convex storage ID for the uploaded PDF file"),
	file_size: z.number().describe("File size in bytes"),
	file_type: z
		.string()
		.optional()
		.describe("MIME type (default: application/pdf)"),
	page_count: z.number().optional().describe("Number of pages in the document"),
	deadline: z
		.string()
		.optional()
		.describe("Signing deadline as ISO 8601 timestamp"),
};

const UpdateDocumentSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The document ID"),
	title: z.string().optional().describe("New document title"),
	description: z.string().optional().describe("New document description"),
	deadline: z
		.string()
		.optional()
		.describe("New signing deadline as ISO 8601 timestamp"),
};

const DocumentIdSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The document ID"),
};

const SendDocumentSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The document ID"),
	message: z
		.string()
		.optional()
		.describe("Custom message to include in the signing email"),
};

const VoidDocumentSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The document ID"),
	reason: z.string().describe("Reason for voiding the document"),
};

/**
 * Registers all document-related tools with the MCP server.
 */
export function registerDocumentTools(
	server: McpServer,
	client: SealApiClient,
): void {
	// List documents
	server.tool(
		"list_documents",
		"List all documents in your Seal workspace with pagination. Returns document metadata including title, status, and recipient counts.",
		ListDocumentsSchema,
		async ({ limit, cursor, status }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<PaginatedResponse<ApiDocument>>(
				"/documents",
				{ limit, cursor, status },
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Get document
	server.tool(
		"get_document",
		"Get detailed information about a specific document including recipients and download URL.",
		GetDocumentSchema,
		async ({ id, include_recipients }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<ApiDocument>(
				"/documents/get",
				{
					id,
					include_recipients,
				},
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Create document
	server.tool(
		"create_document",
		"Create a new document in draft status. Requires a storage ID from a previously uploaded file.",
		CreateDocumentSchema,
		async (
			{
				title,
				description,
				storage_id,
				file_size,
				file_type,
				page_count,
				deadline,
			},
			extra,
		) => {
			const authToken = getAuthToken(extra);
			const response = await client.post<{ id: string }>(
				"/documents",
				{
					title,
					description,
					storage_id,
					file_size,
					file_type,
					page_count,
					deadline: deadline ? new Date(deadline).getTime() : undefined,
				},
				undefined,
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Update document
	server.tool(
		"update_document",
		"Update document metadata. Only works for documents in draft status.",
		UpdateDocumentSchema,
		async ({ id, title, description, deadline }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.put<{ success: boolean }>(
				"/documents/update",
				{
					title,
					description,
					deadline: deadline ? new Date(deadline).getTime() : undefined,
				},
				{ id },
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Delete document
	server.tool(
		"delete_document",
		"Delete a document. Only draft documents can be deleted. Use void_document for sent documents.",
		DocumentIdSchema,
		async ({ id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.delete<{ success: boolean }>(
				"/documents/delete",
				{ id },
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Send document
	server.tool(
		"send_document",
		"Send a document for signing. The document must be in draft status and have at least one recipient.",
		SendDocumentSchema,
		async ({ id, message }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.post<{ success: boolean }>(
				"/documents/send",
				{ message },
				{ id },
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Void document
	server.tool(
		"void_document",
		"Void/cancel a document. Cannot void completed documents. All recipients will be notified.",
		VoidDocumentSchema,
		async ({ id, reason }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.post<{ success: boolean }>(
				"/documents/void",
				{ reason },
				{ id },
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);

	// Download document
	server.tool(
		"download_document",
		"Get the download URL for a document. Returns the signed PDF if available, otherwise the original.",
		DocumentIdSchema,
		async ({ id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<{ url: string }>(
				"/documents/download",
				{
					id,
				},
				authToken,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);
}
