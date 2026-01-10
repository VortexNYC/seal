// @ts-nocheck - MCP SDK has known issues with deep Zod type inference
// Runtime validation still works correctly via Zod
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SealApiClient } from "../client.js";
import type {
	ApiAuditEntry,
	ApiSignature,
	ApiVerificationResult,
} from "../types.js";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

// Define schemas separately to avoid TypeScript "Type instantiation is excessively deep" errors
// Using explicit type annotations helps TypeScript avoid deep recursion
const DocumentIdSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
};

const GetSignatureSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The signature ID"),
};

const GetAuditTrailSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of audit entries to return"),
};

/**
 * Registers all signature-related tools with the MCP server.
 */
export function registerSignatureTools(
	server: McpServer,
	client: SealApiClient,
): void {
	// List signatures
	server.tool(
		"list_signatures",
		"List all signatures for a document. Returns information about each signature including who signed and when.",
		DocumentIdSchema,
		async ({ document_id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<{ signatures: ApiSignature[] }>(
				"/signatures",
				{ document_id },
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

	// Get signature
	server.tool(
		"get_signature",
		"Get detailed information about a specific signature.",
		GetSignatureSchema,
		async ({ document_id, id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<ApiSignature>(
				"/signatures/get",
				{
					document_id,
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

	// Verify document
	server.tool(
		"verify_document",
		"Verify the cryptographic integrity of all signatures on a document. Returns whether each signature is valid and the document hasn't been tampered with.",
		DocumentIdSchema,
		async ({ document_id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<ApiVerificationResult>(
				"/signatures/verify",
				{ document_id },
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

	// Get audit trail
	server.tool(
		"get_audit_trail",
		"Get the complete audit trail for a document. Shows all events including views, signatures, and modifications with timestamps.",
		GetAuditTrailSchema,
		async ({ document_id, limit }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<{ entries: ApiAuditEntry[] }>(
				"/signatures/audit",
				{ document_id, limit },
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
