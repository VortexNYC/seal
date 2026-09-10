import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ApiDocument, PaginatedResponse } from "../api-contracts";
import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";
import { resolveTemplateVariable } from "./variables";

/**
 * Registers document resources with the MCP server.
 */
export function registerDocumentResources(
  server: McpServer,
  client: SealApiClient
): void {
  // List all documents resource
  server.resource(
    "documents",
    "seal://documents",
    {
      description: "List of all documents in your Seal workspace",
      mimeType: "text/plain",
    },
    async (uri, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<PaginatedResponse<ApiDocument>>(
        "/documents",
        { limit: 50 },
        authToken
      );

      const text = response.data
        .map(
          (doc) =>
            `- ${doc.title} (${doc.id})\n  Status: ${doc.status} | Recipients: ${doc.recipients_count} | Signed: ${doc.signed_count}`
        )
        .join("\n\n");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: `# Documents\n\n${text}${response.has_more ? "\n\n(more documents available...)" : ""}`,
          },
        ],
      };
    }
  );

  // Resource template for individual documents
  server.resource(
    "document",
    new ResourceTemplate("seal://documents/{id}", { list: undefined }),
    {
      description: "Get a specific document by ID",
      mimeType: "text/markdown",
    },
    async (uri, { id }, extra) => {
      const authToken = getAuthToken(extra);
      const documentId = resolveTemplateVariable(id);
      const doc = await client.get<ApiDocument>(
        "/documents/get",
        {
          id: documentId,
          include_recipients: true,
        },
        authToken
      );

      let text = `# ${doc.title}\n\n`;
      text += `**ID:** ${doc.id}\n`;
      text += `**Status:** ${doc.status}\n`;
      text += `**Created:** ${doc.created_at}\n`;
      text += `**Updated:** ${doc.updated_at}\n`;
      if (doc.description) {
        text += `**Description:** ${doc.description}\n`;
      }
      if (doc.deadline) {
        text += `**Deadline:** ${doc.deadline}\n`;
      }
      text += `\n## Recipients (${doc.recipients_count})\n\n`;

      if (doc.recipients && doc.recipients.length > 0) {
        for (const recipient of doc.recipients) {
          text += `- **${recipient.name}** (${recipient.email})\n`;
          text += `  Role: ${recipient.role} | Status: ${recipient.status}\n`;
          if (recipient.signed_at) {
            text += `  Signed at: ${recipient.signed_at}\n`;
          }
        }
      } else {
        text += "No recipients yet.\n";
      }

      if (doc.download_url) {
        text += `\n## Download\n\n[Download PDF](${doc.download_url})\n`;
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
