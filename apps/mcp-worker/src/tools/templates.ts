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
import { getAuthToken } from "../utils/auth";

function createToolResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function registerListTemplatesTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_list_templates",
    "List all document templates in your workspace. Templates are reusable document layouts with pre-placed signature fields. Filter by status (active or archived) to find templates ready for use. Use seal_use_template to create a new document from any template returned here.",
    listTemplatesSchema.shape,
    async (args, extra) => {
      const { limit, cursor, status } = args as ListTemplatesInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<PaginatedResponse<ApiTemplate>>(
        "/templates",
        { limit, cursor, status },
        authToken,
      );

      return createToolResponse(response);
    },
  );
}

function registerGetTemplateTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_get_template",
    "Get detailed information about a specific template.",
    getTemplateSchema.shape,
    async (args, extra) => {
      const { id, include_fields } = args as GetTemplateInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiTemplate & { fields?: ApiTemplateField[] }>(
        "/templates/get",
        { id, include_fields },
        authToken,
      );

      return createToolResponse(response);
    },
  );
}

function registerGetTemplateFieldsTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_get_template_fields",
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

      return createToolResponse(response);
    },
  );
}

function registerCreateTemplateTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_create_template",
    "Create a new template from an existing document. The document's fields will be copied to the template.",
    createTemplateSchema.shape,
    async (args, extra) => {
      const { document_id, name, description } = args as CreateTemplateInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ id: string }>(
        "/templates",
        { document_id, name, description },
        undefined,
        authToken,
      );

      return createToolResponse(response);
    },
  );
}

function registerUpdateTemplateTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_update_template",
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

      return createToolResponse(response);
    },
  );
}

function registerDeleteTemplateTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_delete_template",
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

      return createToolResponse(response);
    },
  );
}

function registerUseTemplateTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_use_template",
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

      return createToolResponse(response);
    },
  );
}

/**
 * Registers all template-related tools with the MCP server.
 */
export function registerTemplateTools(server: McpServer, client: SealApiClient): void {
  registerListTemplatesTool(server, client);
  registerGetTemplateTool(server, client);
  registerGetTemplateFieldsTool(server, client);
  registerCreateTemplateTool(server, client);
  registerUpdateTemplateTool(server, client);
  registerDeleteTemplateTool(server, client);
  registerUseTemplateTool(server, client);
}
