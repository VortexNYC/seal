import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaginatedResponse } from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

interface ApiFeedbackItem {
  id: string;
  type: "bug" | "suggestion";
  message: string;
  route?: string;
  user_id: string;
  created_at: string;
}

/**
 * Registers feedback resources with the MCP server.
 */
export function registerFeedbackResources(server: McpServer, client: SealApiClient): void {
  server.resource(
    "feedback",
    "seal://feedback",
    {
      description: "List of all feedback entries in your Seal workspace",
      mimeType: "text/plain",
    },
    async (uri, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<PaginatedResponse<ApiFeedbackItem>>(
        "/feedback",
        { limit: 50 },
        authToken,
      );

      const text = response.data
        .map(
          (item) =>
            `- [${item.type}] ${item.message.slice(0, 80)}${item.message.length > 80 ? "..." : ""}\n  ${item.id} | ${item.created_at}${item.route ? ` | Route: ${item.route}` : ""}`,
        )
        .join("\n\n");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: `# Feedback\n\n${text}${response.has_more ? "\n\n(more feedback entries available...)" : ""}`,
          },
        ],
      };
    },
  );
}
