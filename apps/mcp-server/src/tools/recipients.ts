// @ts-nocheck - MCP SDK has known issues with deep Zod type inference
// Runtime validation still works correctly via Zod
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SealApiClient } from "../client.js";
import type { ApiRecipient } from "../types.js";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

// Define schemas separately to avoid TypeScript "Type instantiation is excessively deep" errors
// Using explicit type annotations helps TypeScript avoid deep recursion
const ListRecipientsSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
};

const GetRecipientSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
};

const AddRecipientSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	email: z.string().email().describe("Recipient email address"),
	name: z.string().describe("Recipient display name"),
	role: z
		.enum(["signer", "approver", "viewer"])
		.describe(
			"Recipient role: signer (needs to sign), approver (needs to approve), viewer (view only)",
		),
	order: z
		.number()
		.optional()
		.describe("Signing order (for sequential signing workflows)"),
	message: z.string().optional().describe("Custom message for this recipient"),
};

const UpdateRecipientSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
	name: z.string().optional().describe("New display name"),
	role: z
		.enum(["signer", "approver", "viewer"])
		.optional()
		.describe("New recipient role"),
	order: z.number().optional().describe("New signing order"),
	message: z.string().optional().describe("New custom message"),
};

const RemoveRecipientSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
};

const SendReminderSchema: Record<string, z.ZodTypeAny> = {
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
	message: z.string().optional().describe("Custom reminder message"),
};

/**
 * Registers all recipient-related tools with the MCP server.
 */
export function registerRecipientTools(
	server: McpServer,
	client: SealApiClient,
): void {
	// List recipients
	server.tool(
		"list_recipients",
		"List all recipients for a document. Recipients are the people who need to sign or review the document.",
		ListRecipientsSchema,
		async ({ document_id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<{ recipients: ApiRecipient[] }>(
				"/recipients",
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

	// Get recipient
	server.tool(
		"get_recipient",
		"Get detailed information about a specific recipient.",
		GetRecipientSchema,
		async ({ document_id, id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.get<ApiRecipient>(
				"/recipients/get",
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

	// Add recipient
	server.tool(
		"add_recipient",
		"Add a recipient to a document. The document must be in draft status.",
		AddRecipientSchema,
		async ({ document_id, email, name, role, order, message }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.post<{ id: string }>(
				"/recipients",
				{ email, name, role, order, message },
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

	// Update recipient
	server.tool(
		"update_recipient",
		"Update a recipient's details. The document must be in draft status.",
		UpdateRecipientSchema,
		async ({ document_id, id, name, role, order, message }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.put<{ success: boolean }>(
				"/recipients/update",
				{ name, role, order, message },
				{ document_id, id },
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

	// Remove recipient
	server.tool(
		"remove_recipient",
		"Remove a recipient from a document. The document must be in draft status.",
		RemoveRecipientSchema,
		async ({ document_id, id }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.delete<{ success: boolean }>(
				"/recipients/delete",
				{ document_id, id },
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

	// Send reminder
	server.tool(
		"send_reminder",
		"Send a signing reminder to a recipient. Only works for recipients who haven't signed yet.",
		SendReminderSchema,
		async ({ document_id, id, message }, extra) => {
			const authToken = getAuthToken(extra);
			const response = await client.post<{ success: boolean }>(
				"/recipients/remind",
				{ message },
				{ document_id, id },
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
