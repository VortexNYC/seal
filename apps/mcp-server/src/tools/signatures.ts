/**
 * @fileoverview Signature tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type ApiAuditEntry,
	type ApiSignature,
	type ApiVerificationResult,
	type GetAuditTrailInput,
	type GetSignatureInput,
	getAuditTrailSchema,
	getSignatureSchema,
	type SignatureDocumentIdInput,
	signatureDocumentIdSchema,
} from "@seal/backend/convex/validations/api";
import type { SealApiClient } from "../client";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
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
		signatureDocumentIdSchema.shape,
		async (args, extra) => {
			const { document_id } = args as SignatureDocumentIdInput;
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
		getSignatureSchema.shape,
		async (args, extra) => {
			const { document_id, id } = args as GetSignatureInput;
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
		signatureDocumentIdSchema.shape,
		async (args, extra) => {
			const { document_id } = args as SignatureDocumentIdInput;
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
		getAuditTrailSchema.shape,
		async (args, extra) => {
			const { document_id, limit } = args as GetAuditTrailInput;
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
