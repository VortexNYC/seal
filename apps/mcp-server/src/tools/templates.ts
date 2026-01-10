// @ts-nocheck - MCP SDK has known issues with deep Zod type inference
// Runtime validation still works correctly via Zod
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SealApiClient } from "../client.js";
import type {
	ApiTemplate,
	ApiTemplateField,
	PaginatedResponse,
} from "../types.js";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

// Define schemas separately to avoid TypeScript "Type instantiation is excessively deep" errors
// Using explicit type annotations helps TypeScript avoid deep recursion
const ListTemplatesSchema: Record<string, z.ZodTypeAny> = {
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of templates to return (1-100, default 20)"),
	cursor: z
		.string()
		.optional()
		.describe("Pagination cursor from previous response"),
	status: z
		.enum(["active", "archived"])
		.optional()
		.describe("Filter by template status"),
};

const GetTemplateSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The template ID"),
	include_fields: z
		.boolean()
		.optional()
		.describe("Include field definitions in response (default false)"),
};

const TemplateIdSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The template ID"),
};

const CreateTemplateSchema: Record<string, z.ZodTypeAny> = {
	document_id: z
		.string()
		.describe("Source document ID to create template from"),
	name: z.string().describe("Template name"),
	description: z.string().optional().describe("Template description"),
};

const UpdateTemplateSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The template ID"),
	name: z.string().optional().describe("New template name"),
	description: z.string().optional().describe("New template description"),
	status: z
		.enum(["active", "archived"])
		.optional()
		.describe("New template status"),
};

const UseTemplateSchema: Record<string, z.ZodTypeAny> = {
	id: z.string().describe("The template ID"),
	title: z
		.string()
		.optional()
		.describe("Title for the new document (defaults to template name)"),
	description: z
		.string()
		.optional()
		.describe("Description for the new document"),
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
		ListTemplatesSchema,
		async ({ limit, cursor, status }, extra) => {
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
		GetTemplateSchema,
		async ({ id, include_fields }, extra) => {
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
		TemplateIdSchema,
		async ({ id }, extra) => {
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
		CreateTemplateSchema,
		async ({ document_id, name, description }, extra) => {
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
		UpdateTemplateSchema,
		async ({ id, name, description, status }, extra) => {
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
		TemplateIdSchema,
		async ({ id }, extra) => {
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
		UseTemplateSchema,
		async ({ id, title, description }, extra) => {
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
