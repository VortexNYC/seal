/**
 * @fileoverview Recipient tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type AddRecipientInput,
	type ApiRecipient,
	addRecipientSchema,
	type GetRecipientInput,
	getRecipientSchema,
	type ListRecipientsInput,
	listRecipientsSchema,
	type RemoveRecipientInput,
	removeRecipientSchema,
	type SendReminderInput,
	sendReminderSchema,
	type UpdateRecipientInput,
	updateRecipientSchema,
} from "@seal/backend/convex/validations/api";
import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

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
		listRecipientsSchema.shape,
		async (args, extra) => {
			const { document_id } = args as ListRecipientsInput;
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
		getRecipientSchema.shape,
		async (args, extra) => {
			const { document_id, id } = args as GetRecipientInput;
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
		addRecipientSchema.shape,
		async (args, extra) => {
			const { document_id, email, name, role, order, message } =
				args as AddRecipientInput;
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
		updateRecipientSchema.shape,
		async (args, extra) => {
			const { document_id, id, name, role, order, message } =
				args as UpdateRecipientInput;
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
		removeRecipientSchema.shape,
		async (args, extra) => {
			const { document_id, id } = args as RemoveRecipientInput;
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
		sendReminderSchema.shape,
		async (args, extra) => {
			const { document_id, id, message } = args as SendReminderInput;
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
