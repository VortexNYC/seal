/**
 * @fileoverview Template tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type ApiTemplate,
	type ApiTemplateField,
	type CreateTemplateInput,
	createTemplateSchema,
	type GetTemplateInput,
	getTemplateSchema,
	type ListTemplatesInput,
	listTemplatesSchema,
	type PaginatedResponse,
	type TemplateIdInput,
	templateIdSchema,
	type UpdateTemplateInput,
	type UseTemplateInput,
	updateTemplateSchema,
	useTemplateSchema,
} from "@seal/backend/convex/validations/api";
import type { SealApiClient } from "../client";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

/**
 * Registers all template-related tools with the MCP server.
 */
export function registerTemplateTools(
	server: McpServer,
	client: SealApiClient,
): void {
	// List templates
	server.tool(
		"list_templates",
		"List all templates in your Seal workspace with pagination.",
		listTemplatesSchema.shape,
		async (args, extra) => {
			const { limit, cursor, status } = args as ListTemplatesInput;
			const authToken = getAuthToken(extra);
			const response = await client.get<PaginatedResponse<ApiTemplate>>(
				"/templates",
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

	// Get template
	server.tool(
		"get_template",
		"Get detailed information about a specific template.",
		getTemplateSchema.shape,
		async (args, extra) => {
			const { id, include_fields } = args as GetTemplateInput;
			const authToken = getAuthToken(extra);
			const response = await client.get<
				ApiTemplate & { fields?: ApiTemplateField[] }
			>("/templates/get", { id, include_fields }, authToken);

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

	// Get template fields
	server.tool(
		"get_template_fields",
		"Get all field definitions for a template. Fields define where signatures and data entry points are located.",
		templateIdSchema.shape,
		async (args, extra) => {
			const { id } = args as TemplateIdInput;
			const authToken = getAuthToken(extra);
			const response = await client.get<{ fields: ApiTemplateField[] }>(
				"/templates/fields",
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

	// Create template
	server.tool(
		"create_template",
		"Create a new template from an existing document. The document's fields will be copied to the template.",
		createTemplateSchema.shape,
		async (args, extra) => {
			const { document_id, name, description } = args as CreateTemplateInput;
			const authToken = getAuthToken(extra);
			const response = await client.post<{ id: string }>(
				"/templates",
				{
					document_id,
					name,
					description,
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

	// Update template
	server.tool(
		"update_template",
		"Update template metadata.",
		updateTemplateSchema.shape,
		async (args, extra) => {
			const { id, name, description, status } = args as UpdateTemplateInput;
			const authToken = getAuthToken(extra);
			const response = await client.put<{ success: boolean }>(
				"/templates/update",
				{ name, description, status },
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

	// Delete template
	server.tool(
		"delete_template",
		"Delete a template. This is a soft delete - the template will be marked as deleted but not removed.",
		templateIdSchema.shape,
		async (args, extra) => {
			const { id } = args as TemplateIdInput;
			const authToken = getAuthToken(extra);
			const response = await client.delete<{ success: boolean }>(
				"/templates/delete",
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

	// Use template
	server.tool(
		"use_template",
		"Create a new document from a template. The new document will have the same fields and layout as the template.",
		useTemplateSchema.shape,
		async (args, extra) => {
			const { id, title, description } = args as UseTemplateInput;
			const authToken = getAuthToken(extra);
			const response = await client.post<{ id: string }>(
				"/templates/use",
				{ title, description },
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
}
