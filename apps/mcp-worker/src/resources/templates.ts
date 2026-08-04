import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ApiTemplate,
  ApiTemplateField,
  PaginatedResponse,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers template resources with the MCP server.
 */
export function registerTemplateResources(
  server: McpServer,
  client: SealApiClient
): void {
  // List all templates resource
  server.resource(
    "templates",
    "seal://templates",
    {
      description: "List of all templates in your Seal workspace",
      mimeType: "text/plain",
    },
    async (uri, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<PaginatedResponse<ApiTemplate>>(
        "/templates",
        { limit: 50, status: "active" },
        authToken
      );

      const text = response.data
        .map(
          (template) =>
            `- ${template.name} (${template.id})\n  Used: ${template.use_count} times | Fields: ${template.field_count ?? "unknown"}`
        )
        .join("\n\n");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: `# Templates\n\n${text}${response.has_more ? "\n\n(more templates available...)" : ""}`,
          },
        ],
      };
    }
  );

  // Resource template for individual templates
  server.resource(
    "template",
    new ResourceTemplate("seal://templates/{id}", { list: undefined }),
    {
      description: "Get a specific template by ID with its fields",
      mimeType: "text/markdown",
    },
    async (uri, { id }, extra) => {
      const authToken = getAuthToken(extra);
      const templateId = id as string;

      // Get template with fields
      const template = await client.get<
        ApiTemplate & { fields?: ApiTemplateField[] }
      >("/templates/get", { id: templateId, include_fields: true }, authToken);

      let text = `# ${template.name}\n\n`;
      text += `**ID:** ${template.id}\n`;
      text += `**Status:** ${template.status}\n`;
      text += `**Created:** ${template.created_at}\n`;
      text += `**Updated:** ${template.updated_at}\n`;
      text += `**Times Used:** ${template.use_count}\n`;
      if (template.description) {
        text += `**Description:** ${template.description}\n`;
      }

      text += `\n## Fields\n\n`;

      if (template.fields && template.fields.length > 0) {
        for (const field of template.fields) {
          text += `### ${field.label}\n`;
          text += `- **Type:** ${field.field_type}\n`;
          text += `- **Required:** ${field.is_required ? "Yes" : "No"}\n`;
          text += `- **Page:** ${field.page}\n`;
          text += `- **Position:** (${field.x}%, ${field.y}%)\n`;
          text += `- **Size:** ${field.width}% x ${field.height}%\n`;
          if (field.properties) {
            if (field.properties.placeholder) {
              text += `- **Placeholder:** ${field.properties.placeholder}\n`;
            }
            if (field.properties.options) {
              text += `- **Options:** ${field.properties.options.join(", ")}\n`;
            }
          }
          text += "\n";
        }
      } else {
        text += "No fields defined.\n";
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text,
          },
        ],
      };
    }
  );
}
